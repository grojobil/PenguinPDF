"""Publish only explicitly moderated feedback; raw exports stay outside Git."""

import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
from datetime import datetime, timezone
import zipfile


HEADERS = [
    "Timestamp",
    "How would you rate PenguinPDF? / ¿Cómo valorarías PenguinPDF?",
    "Your feedback (optional) / Tu comentario (opcional)",
    "Display name (optional) / Nombre público (opcional)",
    "May we feature your comment? (optional) / ¿Podemos publicar tu comentario? (opcional)",
]
CONSENT = (
    "Yes, PenguinPDF may publish my comment and display name on its website. / "
    "Sí, PenguinPDF puede publicar mi comentario y nombre público en su web."
)
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "reviews.json"


def read_responses(path):
    path = Path(path)
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            files = [info for info in archive.infolist() if info.filename.endswith(".csv")]
            if len(files) != 1 or files[0].file_size > 10_000_000:
                raise ValueError("Expected one CSV file, at most 10 MB, in the export.")
            text = archive.read(files[0]).decode("utf-8-sig")
    else:
        if path.stat().st_size > 10_000_000:
            raise ValueError("The CSV export exceeds 10 MB.")
        text = path.read_text(encoding="utf-8-sig")
    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    if next(reader, None) != HEADERS:
        raise ValueError("CSV columns do not match PenguinPDF's feedback form.")
    responses = []
    for row_number, values in enumerate(reader, start=2):
        if len(values) != 5 or not values[0].strip() or values[1] not in "12345" or len(values[1]) != 1:
            raise ValueError(f"Invalid response at CSV row {row_number}.")
        timestamp, rating, comment, name, consent = values
        if consent not in ("", CONSENT):
            raise ValueError(f"Unrecognized publication consent at CSV row {row_number}.")
        identifier = hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()[:16]
        responses.append({
            "row": row_number,
            "id": identifier,
            "rating": int(rating),
            "comment": comment.strip(),
            "displayName": name.strip(),
            "consent": consent == CONSENT,
            "timestamp": timestamp,
        })
    return responses


def build_snapshot(responses, decisions, updated_at=None):
    if not isinstance(decisions, list):
        raise ValueError("Moderation must be a JSON array of per-row decisions.")
    moderation = {}
    for decision in decisions:
        if not isinstance(decision, dict) or type(decision.get("row")) is not int or decision["row"] in moderation:
            raise ValueError("Every moderation decision needs a unique integer CSV row.")
        if decision.get("status") not in ("genuine", "exclude") or type(decision.get("feature", False)) is not bool:
            raise ValueError("Use status genuine/exclude and a boolean feature flag.")
        if decision["status"] == "exclude" and (not str(decision.get("reason", "")).strip() or decision.get("feature")):
            raise ValueError("Excluded responses need a reason and cannot be featured.")
        moderation[decision["row"]] = decision
    if set(moderation) != {response["row"] for response in responses}:
        raise ValueError("Explicitly moderate every CSV response; unknown or missing rows are not allowed.")
    genuine = []
    featured = []
    seen = set()
    for response in responses:
        decision = moderation[response["row"]]
        if decision["status"] == "exclude":
            continue
        if any(response[field].upper().startswith("QA TEST") for field in ("comment", "displayName")):
            raise ValueError("QA TEST responses must be excluded, not counted as reviews.")
        if response["id"] in seen:
            raise ValueError("Duplicate exported response; explicitly exclude the duplicate.")
        seen.add(response["id"])
        genuine.append(response)
        if decision.get("feature"):
            if not response["consent"] or not response["comment"]:
                raise ValueError(f"Row {response['row']} cannot be featured without consent and a comment.")
            if len(response["comment"]) > 600 or len(response["displayName"]) > 60:
                raise ValueError("Featured comments must be at most 600 characters and names at most 60; do not silently edit quotes.")
            featured.append({key: response[key] for key in ("id", "rating", "comment", "displayName")})
    if len(featured) > 6:
        raise ValueError("Feature at most six comments.")
    return {
        "schemaVersion": 1,
        "updatedAt": updated_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ratingCount": len(genuine),
        "ratingSum": sum(response["rating"] for response in genuine),
        "featured": featured,
    }


def write_snapshot(path, snapshot):
    path = Path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as output:
            temporary = Path(output.name)
            json.dump(snapshot, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="Private Google Forms CSV or CSV.zip export")
    parser.add_argument("--inspect", action="store_true", help="Print private responses for local moderation; writes nothing")
    parser.add_argument("--moderation", type=Path, help="Private JSON array of explicit per-row moderation decisions")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        responses = read_responses(args.export)
        if args.inspect:
            print(json.dumps(responses, ensure_ascii=False, indent=2))
            return
        if not args.moderation:
            raise ValueError("Use --inspect first, then supply --moderation; nothing is published automatically.")
        decisions = json.loads(args.moderation.read_text(encoding="utf-8"))
        snapshot = build_snapshot(responses, decisions)
        write_snapshot(args.output, snapshot)
        print(f"Prepared {snapshot['ratingCount']} genuine ratings and {len(snapshot['featured'])} featured comments. Review the diff before committing.")
    except (ValueError, OSError, csv.Error, zipfile.BadZipFile, UnicodeError) as error:
        parser.exit(1, f"No snapshot written: {error}\n")


if __name__ == "__main__":
    main()

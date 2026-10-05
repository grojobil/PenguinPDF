import csv
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile


MODULE_PATH = Path(__file__).with_name("update-reviews.py")
spec = importlib.util.spec_from_file_location("reviews_import", MODULE_PATH)
reviews = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviews)


class ReviewsImportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "private.csv"

    def export(self, rows, headers=None):
        with self.path.open("w", encoding="utf-8", newline="") as output:
            writer = csv.writer(output)
            writer.writerow(headers or reviews.HEADERS)
            writer.writerows(rows)
        return reviews.read_responses(self.path)

    def rows(self):
        return [
            ["2026/09/29 12:01", "5", 'Helpful, with "quoted text"\nand a newline.', "Example", reviews.CONSENT],
            ["2026/09/29 12:02", "1", "Needs work", "Private name", ""],
            ["2026/09/29 12:03", "4", "", "", ""],
        ]

    def decisions(self):
        return [{"row": 2, "status": "genuine", "feature": True}, {"row": 3, "status": "genuine"}, {"row": 4, "status": "genuine"}]

    def test_csv_quoting_unicode_and_zip(self):
        records = self.export(self.rows())
        self.assertEqual(records[0]["comment"], self.rows()[0][2])
        archive = self.path.with_suffix(".zip")
        with zipfile.ZipFile(archive, "w") as output:
            output.write(self.path, "Feedback.csv")
        self.assertEqual(reviews.read_responses(archive), records)

    def test_average_includes_low_unfeatured_and_nonconsenting_ratings(self):
        snapshot = reviews.build_snapshot(self.export(self.rows()), self.decisions())
        self.assertEqual(snapshot["ratingCount"], 3)
        self.assertEqual(snapshot["ratingSum"], 10)
        self.assertEqual(len(snapshot["featured"]), 1)
        self.assertNotIn("Private name", json.dumps(snapshot))
        self.assertNotIn("timestamp", snapshot["featured"][0])
        self.assertNotIn("consent", snapshot["featured"][0])

    def test_no_consent_cannot_publish_comment_or_name(self):
        decisions = self.decisions()
        decisions[1]["feature"] = True
        with self.assertRaisesRegex(ValueError, "without consent"):
            reviews.build_snapshot(self.export(self.rows()), decisions)

    def test_every_response_requires_explicit_moderation(self):
        records = self.export(self.rows())
        for decisions in (self.decisions()[:-1], self.decisions() + [{"row": 99, "status": "genuine"}], self.decisions() * 2):
            with self.assertRaises(ValueError):
                reviews.build_snapshot(records, decisions)

    def test_qa_entries_and_duplicates_cannot_be_counted(self):
        rows = self.rows()
        rows[0][3] = "QA TEST"
        with self.assertRaisesRegex(ValueError, "QA TEST"):
            reviews.build_snapshot(self.export(rows), self.decisions())
        records = self.export([self.rows()[0], self.rows()[0]])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            reviews.build_snapshot(records, self.decisions()[:2])

    def test_exclusions_need_reason_and_do_not_leak_raw_data(self):
        decisions = self.decisions()
        decisions[1] = {"row": 3, "status": "exclude", "reason": "Confirmed duplicate test"}
        snapshot = reviews.build_snapshot(self.export(self.rows()), decisions)
        self.assertEqual((snapshot["ratingCount"], snapshot["ratingSum"]), (2, 9))
        decisions[1].pop("reason")
        with self.assertRaisesRegex(ValueError, "reason"):
            reviews.build_snapshot(self.export(self.rows()), decisions)

    def test_invalid_rating_headers_or_consent_fail_closed(self):
        for index, value in [(1, "6"), (1, ""), (1, "2.5"), (4, "yes")]:
            rows = self.rows()
            rows[0][index] = value
            with self.assertRaises(ValueError):
                self.export(rows)
        with self.assertRaisesRegex(ValueError, "columns"):
            self.export(self.rows(), ["wrong"])

    def test_long_featured_quote_is_not_silently_truncated(self):
        rows = self.rows()
        rows[0][2] = "x" * 601
        with self.assertRaisesRegex(ValueError, "600 characters"):
            reviews.build_snapshot(self.export(rows), self.decisions())

    def test_empty_snapshot_and_atomic_cli_failure_preserve_existing_output(self):
        self.assertEqual(reviews.build_snapshot([], [])["ratingCount"], 0)
        self.export(self.rows())
        output = self.path.with_name("public.json")
        output.write_text("existing output", encoding="utf-8")
        result = subprocess.run([sys.executable, str(MODULE_PATH), str(self.path), "--output", str(output)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_text(encoding="utf-8"), "existing output")

    def test_successful_write_contains_only_public_fields(self):
        snapshot = reviews.build_snapshot(self.export(self.rows()), self.decisions())
        output = self.path.with_name("public.json")
        reviews.write_snapshot(output, snapshot)
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), snapshot)
        self.assertEqual(set(snapshot), {"schemaVersion", "updatedAt", "ratingCount", "ratingSum", "featured", "reviews"})
        validator_url = (MODULE_PATH.parent.parent / "docs" / "review-data.mjs").as_uri()
        result = subprocess.run([
            "node", "--input-type=module", "-e",
            f'import {{ isValidReviews }} from {json.dumps(validator_url)}; '
            'let text = ""; for await (const chunk of process.stdin) text += chunk; '
            'if (!isValidReviews(JSON.parse(text))) process.exit(1);',
        ], input=json.dumps(snapshot), capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_full_archive_all_ratings_in_input_order_and_featured_subset(self):
        rows = [[f"private timestamp {index}", "4" if index < 2 else "5",
                 f"Exact public comment {index}", "Public", reviews.CONSENT] for index in range(36)]
        decisions = [{"row": index + 2, "status": "genuine", "feature": 2 <= index < 12} for index in range(36)]
        records = self.export(rows)
        snapshot = reviews.build_snapshot(records, decisions)
        self.assertEqual(snapshot["schemaVersion"], 2)
        self.assertEqual((snapshot["ratingCount"], snapshot["ratingSum"]), (36, 178))
        self.assertEqual(len(snapshot["reviews"]), 36)
        self.assertEqual(len(snapshot["featured"]), 10)
        self.assertEqual([review["id"] for review in snapshot["reviews"]], [record["id"] for record in records])
        self.assertEqual([review["rating"] for review in snapshot["reviews"][:2]], [4, 4])
        for review in snapshot["featured"]:
            self.assertIn(review, snapshot["reviews"])
        for review in snapshot["reviews"]:
            self.assertEqual(set(review), {"id", "rating", "comment", "displayName"})
        self.assertNotIn("private timestamp", json.dumps(snapshot))

    def test_safety_and_consent_filter_archive_without_affecting_aggregate(self):
        comments = ["Safe criticism", "Visit https://example.com/private", "Email me@example.com",
                    "Call +1 212 555 1234", "x" * 601, "", "Private criticism", "Literal <script>attack()</script>"]
        rows = [[str(index), "1", comment, "", "" if index == 6 else reviews.CONSENT]
                for index, comment in enumerate(comments)]
        decisions = [{"row": index + 2, "status": "genuine"} for index in range(len(rows))]
        snapshot = reviews.build_snapshot(self.export(rows), decisions)
        self.assertEqual((snapshot["ratingCount"], snapshot["ratingSum"]), (8, 8))
        self.assertEqual([review["comment"] for review in snapshot["reviews"]], [comments[0], comments[7]])
        self.assertEqual(snapshot["featured"], [])
        decisions[1]["feature"] = True
        with self.assertRaisesRegex(ValueError, "contact details"):
            reviews.build_snapshot(self.export(rows), decisions)

    def test_explicit_low_rating_feature_decisions_remain_supported(self):
        rows = [["private", "1", "Critical comment", "", reviews.CONSENT]]
        snapshot = reviews.build_snapshot(self.export(rows), [{"row": 2, "status": "genuine", "feature": True}])
        self.assertEqual(snapshot["featured"], snapshot["reviews"])
        self.assertEqual(snapshot["ratingSum"], 1)

    def test_unicode_size_and_count_overflow_preserve_output(self):
        rows = [[str(index), "4", "😀" * 600, "", reviews.CONSENT] for index in range(90)]
        decisions = [{"row": index + 2, "status": "genuine"} for index in range(len(rows))]
        with self.assertRaisesRegex(ValueError, "200000 bytes"):
            reviews.build_snapshot(self.export(rows), decisions)
        rows = [[str(index), "1", "x", "", reviews.CONSENT] for index in range(5001)]
        decisions = [{"row": index + 2, "status": "genuine"} for index in range(len(rows))]
        with self.assertRaisesRegex(ValueError, "5000-review"):
            reviews.build_snapshot(self.export(rows), decisions)
        output = self.path.with_name("public.json")
        output.write_text("last good", encoding="utf-8")
        snapshot = reviews.build_snapshot([], [])
        snapshot["reviews"] = [{"id": f"{index:016x}", "rating": 4, "comment": "😀" * 600,
                                "displayName": ""} for index in range(90)]
        with self.assertRaises(ValueError):
            reviews.write_snapshot(output, snapshot)
        self.assertEqual(output.read_text(encoding="utf-8"), "last good")

    def test_dated_public_records_copy_metadata_and_keep_private_dates_private(self):
        records = self.export(self.rows())
        records[0].update(date="2026-09-29", dateType="imported")
        records[1].update(date="2026-10-05", dateType="submitted")
        snapshot = reviews.build_snapshot(records, self.decisions())
        expected = {key: records[0][key] for key in ("id", "rating", "comment", "displayName", "date", "dateType")}
        self.assertEqual(snapshot["reviews"], [expected])
        self.assertEqual(snapshot["featured"], [expected])
        self.assertIsNot(snapshot["featured"][0], snapshot["reviews"][0])
        self.assertNotIn("2026-10-05", json.dumps(snapshot["reviews"]))
        self.assertNotIn("timestamp", json.dumps(snapshot))
        self.assertNotIn("2026/09/29 12:01", json.dumps(snapshot))
        self.assertNotIn("consent", json.dumps(snapshot))
        validator_url = (MODULE_PATH.parent.parent / "docs" / "review-data.mjs").as_uri()
        result = subprocess.run([
            "node", "--input-type=module", "-e",
            f'import {{ isValidReviews }} from {json.dumps(validator_url)}; '
            'let text = ""; for await (const chunk of process.stdin) text += chunk; '
            'if (!isValidReviews(JSON.parse(text))) process.exit(1);',
        ], input=json.dumps(snapshot), capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_calendar_dates_and_provenance_validate_without_guessing_csv_dates(self):
        records = self.export(self.rows())
        undated = reviews.build_snapshot(records, self.decisions())
        self.assertNotIn("date", undated["reviews"][0])
        self.assertNotIn("dateType", undated["featured"][0])
        for day in ("0001-01-01", "2000-02-29", "2024-02-29", "2400-02-29", "9999-12-31"):
            for date_type in ("submitted", "imported"):
                with self.subTest(day=day, date_type=date_type):
                    records[0].update(date=day, dateType=date_type)
                    snapshot = reviews.build_snapshot(records, self.decisions())
                    self.assertEqual(snapshot["reviews"][0]["date"], day)
                    self.assertEqual(snapshot["reviews"][0]["dateType"], date_type)
                    self.assertEqual(snapshot["reviews"][0], snapshot["featured"][0])

    def test_unpaired_or_invalid_date_metadata_fails_closed(self):
        invalid = [
            {"date": "2026-09-29"}, {"dateType": "imported"},
            {"date": "2026-09-29", "dateType": "verified"},
            {"date": "2026-09-29", "dateType": None},
        ] + [{"date": day, "dateType": "submitted"} for day in (
            "0000-01-01", "1900-02-29", "2100-02-29", "2025-02-29", "2026-04-31", "2026-00-01",
            "2026-13-01", "2026-01-00", "2026-01-32", "2026-9-29", "26-09-29", "2026-09-29\n",
            "2026-09-29T12:00:00Z", "２０２６-０９-２９", None, 20260929,
        )]
        for metadata in invalid:
            with self.subTest(metadata=metadata):
                records = self.export(self.rows())
                records[0].update(metadata)
                with self.assertRaisesRegex(ValueError, "date metadata"):
                    reviews.build_snapshot(records, self.decisions())

    def test_mixed_undated_and_dated_low_ratings_keep_input_order(self):
        rows = [["2026/09/29 12:01", "4", "Critical comment", "", reviews.CONSENT],
                ["09/28/2026 05:40 PM", "5", "Legacy comment", "", reviews.CONSENT]]
        records = self.export(rows)
        records[0].update(date="2026-10-05", dateType="submitted")
        decisions = [{"row": 2, "status": "genuine"}, {"row": 3, "status": "genuine", "feature": True}]
        snapshot = reviews.build_snapshot(records, decisions)
        self.assertEqual([review["id"] for review in snapshot["reviews"]], [record["id"] for record in records])
        self.assertEqual(snapshot["reviews"][0]["rating"], 4)
        self.assertEqual(snapshot["reviews"][0]["date"], "2026-10-05")
        self.assertNotIn("date", snapshot["reviews"][1])
        self.assertEqual(snapshot["featured"], [snapshot["reviews"][1]])


if __name__ == "__main__":
    unittest.main()

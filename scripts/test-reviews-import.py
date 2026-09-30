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
        self.assertEqual(set(snapshot), {"schemaVersion", "updatedAt", "ratingCount", "ratingSum", "featured"})


if __name__ == "__main__":
    unittest.main()

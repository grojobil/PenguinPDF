import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidReviews } from "../docs/review-data.mjs";

const card = (index, rating = 5) => ({
  id: index.toString(16).padStart(16, "0"), rating,
  comment: `Public comment ${index}`, displayName: "",
});
const legacy = { schemaVersion: 1, updatedAt: "2026-10-05T00:00:00Z", ratingCount: 2, ratingSum: 6, featured: [card(1)] };
const modern = { ...legacy, schemaVersion: 2, reviews: [card(1), card(2, 1)] };

test("both schemas support low ratings and exact public-only fields", () => {
  assert.ok(isValidReviews(legacy));
  assert.ok(isValidReviews({ ...legacy, featured: [card(1, 1)] }));
  assert.ok(isValidReviews(modern));
  for (const invalid of [null, {}, { ...modern, schemaVersion: 3 },
    { ...legacy, reviews: [] }, { ...modern, email: "private" },
    { ...modern, reviews: [{ ...card(1), consent: true }, card(2, 1)] },
    { ...modern, reviews: [card(1), card(1)] },
    { ...modern, featured: [card(3)] },
    { ...modern, featured: [{ ...card(1), displayName: "Changed" }] },
    { ...modern, featured: [card(1), card(1)] },
    { ...modern, ratingCount: 1 }, { ...modern, ratingSum: 7 },
    { ...modern, updatedAt: "invalid" }]) assert.equal(isValidReviews(invalid), false);
});

test("full collection drives feasibility; featured is not counted twice", () => {
  const reviews = Array.from({ length: 36 }, (_, index) => card(index, index < 2 ? 4 : 5));
  const snapshot = { ...modern, ratingCount: 36, ratingSum: 178, reviews, featured: reviews.slice(2, 12) };
  assert.ok(isValidReviews(snapshot));
  assert.equal(isValidReviews({ ...snapshot, ratingSum: 179 }), false);
  assert.ok(isValidReviews({ ...snapshot, ratingCount: 37, ratingSum: 179 }));
  assert.equal(isValidReviews({ ...snapshot, ratingCount: 37, ratingSum: 184 }), false);
});

test("codepoint, collection, and numeric limits fail closed", () => {
  const single = { ...modern, ratingCount: 1, ratingSum: 5, featured: [], reviews: [card(1)] };
  assert.ok(isValidReviews({ ...single, reviews: [{ ...card(1), comment: "😀".repeat(600), displayName: "😀".repeat(60) }] }));
  for (const change of [
    { comment: "😀".repeat(601) }, { displayName: "😀".repeat(61) },
    { comment: " \n " }, { rating: 0 }, { rating: 6 }, { rating: 1.5 }, { id: "raw-id" },
  ]) assert.equal(isValidReviews({ ...single, reviews: [{ ...card(1), ...change }] }), false);
  const reviews = Array.from({ length: 5000 }, (_, index) => card(index));
  assert.ok(isValidReviews({ ...single, ratingCount: 5000, ratingSum: 25000, reviews }));
  assert.equal(isValidReviews({ ...single, ratingCount: 5001, ratingSum: 25005, reviews: [...reviews, card(5000)] }), false);
  assert.equal(isValidReviews({ ...single, ratingCount: Number.MAX_SAFE_INTEGER, ratingSum: Number.MAX_SAFE_INTEGER }), false);
});

test("optional paired dates accept true Gregorian days in either schema", () => {
  for (const date of ["0001-01-01", "2000-02-29", "2024-02-29", "2400-02-29", "2026-04-30", "9999-12-31"]) {
    for (const dateType of ["submitted", "imported"]) {
      const dated = { ...card(1), date, dateType };
      assert.ok(isValidReviews({ ...legacy, featured: [dated] }));
      assert.ok(isValidReviews({ ...modern, featured: [dated], reviews: [dated, card(2, 1)] }));
    }
  }
  const dated = { ...card(1), date: "2026-09-29", dateType: "imported" };
  for (const invalid of [
    { ...modern, featured: [card(1)], reviews: [dated, card(2, 1)] },
    { ...modern, featured: [dated], reviews: modern.reviews },
    { ...modern, featured: [{ ...dated, date: "2026-09-28" }], reviews: [dated, card(2, 1)] },
    { ...modern, featured: [{ ...dated, dateType: "submitted" }], reviews: [dated, card(2, 1)] },
  ]) assert.equal(isValidReviews(invalid), false);
});

test("invalid calendar days, unpaired dates, and unknown metadata fail closed", () => {
  const metadata = [
    { date: "2026-09-29" }, { dateType: "submitted" },
    { date: "2026-09-29", dateType: "verified" },
    { date: "2026-09-29", dateType: "imported", timestamp: "private" },
    { date: "2026-09-29", dateType: null },
    ...["0000-01-01", "1900-02-29", "2100-02-29", "2025-02-29", "2026-04-31",
      "2026-00-01", "2026-13-01", "2026-01-00", "2026-01-32", "2026-9-29", "26-09-29",
      " 2026-09-29", "2026-09-29\n", "2026-09-29T12:00:00Z", "２０２６-０９-２９", null, 20260929]
      .map(date => ({ date, dateType: "submitted" })),
  ];
  for (const extra of metadata) {
    const review = { ...card(1), ...extra };
    assert.equal(isValidReviews({ ...legacy, featured: [review] }), false);
    assert.equal(isValidReviews({ ...modern, featured: [review], reviews: [review, card(2, 1)] }), false);
  }
});

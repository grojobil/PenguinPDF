import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("reviews-feed.gs", import.meta.url), "utf8");
const TYPES = {
  RATING: "RATING",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  PARAGRAPH_TEXT: "PARAGRAPH_TEXT",
  TEXT: "TEXT",
  CHECKBOX: "CHECKBOX",
};
const TITLES = {
  rating: "How would you rate PenguinPDF? / ¿Cómo valorarías PenguinPDF?",
  comment: "Your feedback (optional) / Tu comentario (opcional)",
  name: "Display name (optional) / Nombre público (opcional)",
  consent: "May we feature your comment? (optional) / ¿Podemos publicar tu comentario? (opcional)",
};
const CONSENT = "Yes, PenguinPDF may publish my comment and display name on its website. / Sí, PenguinPDF puede publicar mi comentario y nombre público en su web.";
const UPDATED = "2026-09-29T20:00:00.000Z";
const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
});

function createHarness() {
  const propertyData = new Map();
  const outputs = [];
  const locks = [];
  const triggerState = { triggers: [], created: 0 };
  const formattedDates = [];
  let activeForm = null;
  let failSetAt = Infinity;
  let setCount = 0;

  const properties = {
    getProperties() { return Object.fromEntries(propertyData); },
    getProperty(key) { return propertyData.has(key) ? propertyData.get(key) : null; },
    setProperty(key, value) {
      setCount += 1;
      if (setCount === failSetAt) throw new Error("simulated property failure with private details");
      propertyData.set(key, value);
      return properties;
    },
    deleteProperty(key) { propertyData.delete(key); return properties; },
  };
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Math,
    Number,
    Object,
    Array,
    String,
    RegExp,
    Error,
    FormApp: {
      ItemType: TYPES,
      getActiveForm() { return activeForm; },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      formatDate(date, timeZone, pattern) {
        assert.ok(date instanceof Date);
        assert.equal(timeZone, "America/Los_Angeles");
        assert.equal(pattern, "yyyy-MM-dd");
        formattedDates.push(date.getTime());
        const parts = Object.fromEntries(DAY_FORMATTER.formatToParts(date).map(part => [part.type, part.value]));
        return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
      },
      computeDigest(algorithm, value, charset) {
        assert.equal(algorithm, "SHA_256");
        assert.equal(charset, "UTF_8");
        return [...createHash("sha256").update(value, "utf8").digest()]
          .map(byte => byte > 127 ? byte - 256 : byte);
      },
      newBlob(value) {
        return {
          getBytes: () => [...Buffer.from(value, "utf8")]
            .map(byte => byte > 127 ? byte - 256 : byte),
        };
      },
    },
    PropertiesService: { getScriptProperties: () => properties },
    LockService: {
      getScriptLock() {
        const lock = {
          waited: false,
          released: false,
          waitLock() { this.waited = true; },
          releaseLock() { this.released = true; },
        };
        locks.push(lock);
        return lock;
      },
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(body) {
        const output = {
          body,
          mimeType: null,
          setMimeType(type) { this.mimeType = type; return this; },
        };
        outputs.push(output);
        return output;
      },
    },
    ScriptApp: {
      EventType: { CLOCK: "CLOCK", ON_FORM_SUBMIT: "ON_FORM_SUBMIT" },
      getProjectTriggers: () => triggerState.triggers,
      newTrigger(handler) {
        assert.equal(handler, "refreshReviews");
        return {
          timeBased() { return this; },
          everyHours(hours) { assert.equal(hours, 1); return this; },
          create() {
            triggerState.created += 1;
            triggerState.triggers.push(trigger("refreshReviews", "CLOCK"));
          },
        };
      },
    },
  });
  vm.runInContext(source, context, { filename: "reviews-feed.gs" });
  return {
    context,
    propertyData,
    outputs,
    locks,
    triggerState,
    formattedDates,
    properties,
    setForm(form) { activeForm = form; },
    failNextSet(after = 1) { failSetAt = setCount + after; },
    clearSetFailure() { failSetAt = Infinity; },
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function record(overrides = {}) {
  return {
    id: "source-response-1",
    rating: 5,
    comment: "A polished and genuinely useful PDF app.",
    displayName: "Reviewer",
    consent: true,
    timestamp: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

function item(title, type) {
  return { getTitle: () => title, getType: () => type };
}

function standardItems() {
  return [
    item(TITLES.comment, TYPES.PARAGRAPH_TEXT),
    item(TITLES.consent, TYPES.CHECKBOX),
    item(TITLES.rating, TYPES.RATING),
    item(TITLES.name, TYPES.TEXT),
  ];
}

function formResponse(values = {}, responseItems = standardItems()) {
  const byTitle = new Map(responseItems.map(entry => [entry.getTitle(), entry]));
  const defaults = {
    [TITLES.rating]: "5",
    [TITLES.comment]: "A precise response from the form.",
    [TITLES.name]: "Form Reviewer",
    [TITLES.consent]: [CONSENT],
  };
  const merged = { ...defaults, ...values };
  const responses = Object.entries(merged)
    .filter(([, value]) => value !== undefined)
    .map(([title, value]) => ({ getItem: () => byTitle.get(title), getResponse: () => value }));
  return {
    getId: () => values.id || "form-source-id",
    getTimestamp: () => new Date(values.timestamp || "2026-09-29T12:00:00.000Z"),
    getItemResponses: () => responses.reverse(),
  };
}

function form(responses, items = standardItems()) {
  return { getItems: () => items, getResponses: () => responses };
}

function trigger(handler, eventType) {
  return { getHandlerFunction: () => handler, getEventType: () => eventType };
}

function publicId(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

test("all valid ratings count, while only precise consent can produce a card", () => {
  const { context } = createHarness();
  const snapshot = plain(context.buildPublicReviews([
    record({ id: "low-private", rating: 1, comment: "Private criticism", displayName: "Private Person", consent: false }),
    record({ id: "five-no-consent", comment: "Do not publish", displayName: "Hidden", consent: false }),
    record({ id: "empty-comment", rating: 4, comment: "", displayName: "", consent: true }),
    record({ id: "public-five", comment: "Publish this exact wording.  ", displayName: "Public Name" }),
  ], UPDATED));
  assert.equal(snapshot.ratingCount, 4);
  assert.equal(snapshot.ratingSum, 15);
  assert.equal(snapshot.featured.length, 1);
  assert.equal(snapshot.featured[0].comment, "Publish this exact wording.  ");
  assert.equal(snapshot.featured[0].displayName, "Public Name");
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /Private criticism|Private Person|Do not publish|Hidden|low-private|timestamp|consent/);
});

test("form responses are matched by exact titles, and header or type drift preserves prior data", () => {
  const harness = createHarness();
  harness.setForm(form([formResponse({
    [TITLES.rating]: "1",
    [TITLES.comment]: "Not public",
    [TITLES.name]: "Not public either",
    [TITLES.consent]: [],
  })]));
  const initial = plain(harness.context.refreshReviews());
  assert.equal(initial.ratingSum, 1);
  const before = new Map(harness.propertyData);

  const wrongItems = standardItems();
  wrongItems[0] = item(`${TITLES.comment} changed`, TYPES.PARAGRAPH_TEXT);
  harness.setForm(form([], wrongItems));
  assert.throws(() => harness.context.refreshReviews(), /^Error: Review refresh failed\.$/);
  assert.deepEqual([...harness.propertyData], [...before]);

  const wrongTypeItems = standardItems();
  wrongTypeItems[2] = item(TITLES.rating, TYPES.MULTIPLE_CHOICE);
  harness.setForm(form([], wrongTypeItems));
  assert.throws(() => harness.context.refreshReviews(), /^Error: Review refresh failed\.$/);
  assert.deepEqual([...harness.propertyData], [...before]);
});

test("only the importer's exact consent option is accepted from the form source", () => {
  const harness = createHarness();
  harness.setForm(form([formResponse({ [TITLES.consent]: ["Yes"] })]));
  assert.throws(() => harness.context.refreshReviews(), /^Error: Review refresh failed\.$/);
  assert.equal(harness.propertyData.size, 0);

  harness.setForm(form([formResponse({ [TITLES.consent]: [] })]));
  const privateSnapshot = plain(harness.context.refreshReviews());
  assert.equal(privateSnapshot.ratingCount, 1);
  assert.deepEqual(privateSnapshot.featured, []);
});

test("native rating responses accept only 1-5 integer numbers or one-character strings", () => {
  for (const rating of [1, 5, "1", "5"]) {
    const harness = createHarness();
    harness.setForm(form([formResponse({ [TITLES.rating]: rating })]));
    const snapshot = plain(harness.context.refreshReviews());
    assert.equal(snapshot.ratingCount, 1);
    assert.equal(snapshot.ratingSum, Number(rating));
  }

  for (const rating of [0, 6, 1.5, NaN, "0", "6", "1.0", "05", true, null]) {
    const harness = createHarness();
    harness.setForm(form([formResponse({ [TITLES.rating]: rating })]));
    assert.throws(() => harness.context.refreshReviews(), /^Error: Review refresh failed\.$/);
    assert.equal(harness.propertyData.size, 0);
  }
});

test("QA-prefixed entries and duplicate source ids are excluded from aggregates", () => {
  const { context } = createHarness();
  const snapshot = plain(context.buildPublicReviews([
    record({ id: "qa-name", rating: 1, displayName: "  qa test setup" }),
    record({ id: "qa-comment", rating: 2, comment: "QA TEST smoke response" }),
    record({ id: "duplicate", rating: 3, comment: "First duplicate", consent: false }),
    record({ id: "duplicate", rating: 3, comment: "First duplicate", consent: false }),
    record({ id: "real", rating: 5, comment: "A real public response" }),
  ], UPDATED));
  assert.equal(snapshot.ratingCount, 2);
  assert.equal(snapshot.ratingSum, 8);
  assert.deepEqual(snapshot.featured.map(card => card.comment), ["A real public response"]);
});

test("selection is recent-first, near-distinct, five-star only, and capped at ten", () => {
  const { context } = createHarness();
  const records = Array.from({ length: 13 }, (_, index) => record({
    id: `varied-${index}`,
    rating: index === 12 ? 4 : 5,
    comment: `Distinct workflow ${index}: ${"useful ".repeat(index + 1)}result`,
    timestamp: new Date(Date.UTC(2026, 8, 29, 0, index)).toISOString(),
  }));
  records.push(record({
    id: "near-duplicate-newest",
    comment: "  DISTINCT workflow 11 useful useful useful useful useful useful useful useful useful useful useful useful result!!! ",
    timestamp: "2026-09-29T23:59:00.000Z",
  }));
  const snapshot = plain(context.buildPublicReviews(records.reverse(), UPDATED));
  assert.equal(snapshot.ratingCount, 14);
  assert.equal(snapshot.featured.length, 10);
  assert.equal(snapshot.featured[0].id, publicId("near-duplicate-newest"));
  assert.ok(snapshot.featured.every(card => card.rating === 5));
  assert.equal(new Set(snapshot.featured.map(card => card.id)).size, 10);
  assert.equal(snapshot.featured.some(card => card.id === publicId("varied-11")), false);
});

test("Unicode codepoint limits are exact and overlong text only suppresses cards", () => {
  const { context } = createHarness();
  const snapshot = plain(context.buildPublicReviews([
    record({ id: "comment-600", comment: "😀".repeat(600), displayName: "ñ".repeat(60) }),
    record({ id: "comment-601", comment: "😀".repeat(601) }),
    record({ id: "name-61", comment: "Valid comment", displayName: "😀".repeat(61) }),
  ], UPDATED));
  assert.equal(snapshot.ratingCount, 3);
  assert.equal(snapshot.ratingSum, 15);
  assert.equal(snapshot.featured.length, 1);
  assert.equal([...snapshot.featured[0].comment].length, 600);
  assert.equal([...snapshot.featured[0].displayName].length, 60);
});

test("malicious-looking HTML remains literal data and source-private fields never appear", () => {
  const { context } = createHarness();
  const comment = '<img src=x onerror="attack()"><script>attack()</script>';
  const displayName = "<svg onload=attack()>";
  const snapshot = plain(context.buildPublicReviews([
    record({ id: "private-source-identifier", comment, displayName, timestamp: "2026-09-29T12:34:56Z" }),
  ], UPDATED));
  assert.equal(snapshot.featured[0].comment, comment);
  assert.equal(snapshot.featured[0].displayName, displayName);
  assert.deepEqual(Object.keys(snapshot.featured[0]), ["id", "rating", "comment", "displayName", "date", "dateType"]);
  assert.doesNotMatch(JSON.stringify(snapshot), /private-source-identifier|2026-09-29T12:34:56Z|consent/);
});

test("obvious contact payloads affect cards but never aggregate ratings", () => {
  const { context } = createHarness();
  const snapshot = plain(context.buildPublicReviews([
    record({ id: "link", comment: "Visit https://example.com/private" }),
    record({ id: "email", comment: "Email reviewer@example.com" }),
    record({ id: "safe", comment: "No contact details in this response" }),
  ], UPDATED));
  assert.equal(snapshot.ratingCount, 3);
  assert.equal(snapshot.ratingSum, 15);
  assert.deepEqual(snapshot.featured.map(card => card.comment), ["No contact details in this response"]);
});

test("a partial property write cannot replace the previous complete snapshot", () => {
  const harness = createHarness();
  const first = harness.context.buildPublicReviews([record({ id: "old", comment: "Old complete snapshot" })], UPDATED);
  harness.context.storeSnapshot_(first);
  const before = plain(harness.context.readStoredSnapshot_());

  const replacement = harness.context.buildPublicReviews([
    record({ id: "new-1", comment: "First replacement card" }),
    record({ id: "new-2", comment: "Second replacement card", timestamp: "2026-09-29T13:00:00Z" }),
  ], "2026-09-29T21:00:00.000Z");
  harness.failNextSet(2);
  assert.throws(() => harness.context.storeSnapshot_(replacement));
  harness.clearSetFailure();
  assert.deepEqual(plain(harness.context.readStoredSnapshot_()), before);
  assert.ok(harness.locks.every(lock => lock.waited && lock.released));
});

test("doGet only reads sanitized properties and returns a generic uninitialized error", () => {
  const harness = createHarness();
  Object.defineProperty(harness.context.FormApp, "getActiveForm", {
    value() { throw new Error("Forms must not be read by doGet"); },
  });
  let output = harness.context.doGet({ source: "attacker-controlled", formId: "other-form" });
  assert.equal(output.mimeType, "application/json");
  assert.deepEqual(JSON.parse(output.body), { error: "Reviews unavailable." });
  assert.doesNotMatch(output.body, /Forms|attacker|other-form/);

  const snapshot = harness.context.buildPublicReviews([record()], UPDATED);
  harness.context.storeSnapshot_(snapshot);
  output = harness.context.doGet({ source: "ignored" });
  assert.deepEqual(JSON.parse(output.body), plain(snapshot));

  const meta = JSON.parse(harness.propertyData.get("reviews.feed.meta.v1"));
  const cardKey = `reviews.feed.chunk.v2.${meta.generation}.0`;
  const corrupted = JSON.parse(harness.propertyData.get(cardKey));
  corrupted.reviews[0].rawResponse = "private response data";
  harness.propertyData.set(cardKey, JSON.stringify(corrupted));
  output = harness.context.doGet();
  assert.deepEqual(JSON.parse(output.body), { error: "Reviews unavailable." });
  assert.doesNotMatch(output.body, /private response data/);
});

test("setup refreshes first and creates at most one hourly trigger without deleting others", () => {
  const harness = createHarness();
  harness.setForm(form([]));
  harness.triggerState.triggers.push(trigger("otherHandler", "CLOCK"), trigger("refreshReviews", "ON_FORM_SUBMIT"));
  harness.context.setupReviewAutomation();
  assert.equal(harness.triggerState.created, 1);
  assert.equal(harness.triggerState.triggers.length, 3);
  harness.context.setupReviewAutomation();
  assert.equal(harness.triggerState.created, 1);
  assert.equal(harness.triggerState.triggers.length, 3);
});

test("the script declares current-document scope and no forbidden service surface", () => {
  assert.match(source, /^\/\*\* @OnlyCurrentDoc \*\//);
  assert.doesNotMatch(source, /UrlFetchApp|GmailApp|DriveApp|SpreadsheetApp|openById|openByUrl|OAuth|Logger\./);
  assert.doesNotMatch(source, /function (?:sha256Hex_|utf8Bytes_|rotateRight_)\b/);
});

test("all 36 consenting comments survive, including low ratings and duplicate text", () => {
  const harness = createHarness();
  const records = Array.from({ length: 36 }, (_, index) => record({
    id: `full-${index}`, rating: index < 2 ? 4 : 5,
    comment: index < 2 ? "Critical feedback" : `Public feedback ${index}`,
    timestamp: new Date(Date.UTC(2026, 9, 5, 0, index)).toISOString(),
  }));
  const snapshot = plain(harness.context.buildPublicReviews(records, UPDATED));
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.ratingCount, 36);
  assert.equal(snapshot.ratingSum, 178);
  assert.equal(snapshot.reviews.length, 36);
  assert.equal(snapshot.reviews.filter(review => review.rating === 4).length, 2);
  assert.deepEqual(snapshot.reviews.slice(0, 2).map(review => review.id), [publicId("full-35"), publicId("full-34")]);
  assert.equal(snapshot.featured.length, 10);
  assert.ok(snapshot.featured.every(review => snapshot.reviews.some(other => JSON.stringify(other) === JSON.stringify(review))));
  harness.context.storeSnapshot_(snapshot);
  assert.deepEqual(plain(harness.context.readStoredSnapshot_()), snapshot);
});

test("archive validates featured membership and aggregate feasibility without double counting", () => {
  const { context } = createHarness();
  const snapshot = plain(context.buildPublicReviews([record(), record({ id: "low", rating: 1, comment: "Needs improvement" })], UPDATED));
  assert.equal(context.isValidPublicSnapshot_(snapshot), true);
  for (const invalid of [
    { ...snapshot, ratingSum: 7 },
    { ...snapshot, featured: [{ ...snapshot.featured[0], comment: "Changed quote" }] },
    { ...snapshot, reviews: [snapshot.reviews[0], snapshot.reviews[0]] },
    { ...snapshot, reviews: [{ ...snapshot.reviews[0], consent: true }] },
  ]) assert.equal(context.isValidPublicSnapshot_(invalid), false);
});

test("chunked Unicode storage replaces generations and failures preserve every old property", () => {
  const harness = createHarness();
  const records = Array.from({ length: 40 }, (_, index) => record({
    id: `unicode-${index}`, comment: "😀".repeat(600), rating: 4,
  }));
  const first = harness.context.buildPublicReviews(records, UPDATED);
  harness.context.storeSnapshot_(first);
  const before = new Map(harness.propertyData);
  const replacement = { ...plain(first), updatedAt: "2026-10-05T00:00:00Z" };
  const chunks = JSON.parse(harness.propertyData.get("reviews.feed.meta.v1")).chunkCount;
  assert.ok(chunks > 1);
  for (const failAt of [1, 2, chunks + 1]) {
    harness.failNextSet(failAt);
    assert.throws(() => harness.context.storeSnapshot_(replacement));
    harness.clearSetFailure();
    assert.deepEqual([...harness.propertyData], [...before]);
    assert.deepEqual(plain(harness.context.readStoredSnapshot_()), plain(first));
  }
  harness.context.storeSnapshot_(replacement);
  assert.deepEqual(plain(harness.context.readStoredSnapshot_()), replacement);
  const newMeta = JSON.parse(harness.propertyData.get("reviews.feed.meta.v1"));
  assert.equal(harness.propertyData.size, newMeta.chunkCount + 1);
  for (const value of harness.propertyData.values()) assert.ok(Buffer.byteLength(value) <= 9000);
});

test("snapshot and store overflow reject before writes with last-good data intact", () => {
  const harness = createHarness();
  const first = harness.context.buildPublicReviews([record()], UPDATED);
  harness.context.storeSnapshot_(first);
  const before = new Map(harness.propertyData);
  const records = Array.from({ length: 90 }, (_, index) => record({
    id: `overflow-${index}`, comment: "😀".repeat(600), rating: 4,
  }));
  assert.throws(() => harness.context.buildPublicReviews(records, UPDATED), /too large/);
  const oversized = { ...plain(first), ratingCount: 90, ratingSum: 360, featured: [],
    reviews: records.map((entry, index) => ({ id: index.toString(16).padStart(16, "0"), rating: 4, comment: entry.comment, displayName: "" })) };
  assert.throws(() => harness.context.storeSnapshot_(oversized), /too large/);
  assert.deepEqual([...harness.propertyData], [...before]);
  for (var index = 0; index < 60; index += 1) harness.propertyData.set(`unrelated-${index}`, "x".repeat(8000));
  const full = new Map(harness.propertyData);
  const replacement = harness.context.buildPublicReviews(records.slice(0, 10), UPDATED);
  assert.throws(() => harness.context.storeSnapshot_(replacement), /capacity/);
  assert.deepEqual([...harness.propertyData], [...full]);
  assert.deepEqual(plain(harness.context.readStoredSnapshot_()), plain(first));
});

test("5001 eligible reviews fail closed rather than silently truncating", () => {
  const { context } = createHarness();
  assert.throws(() => context.buildPublicReviews(Array.from({ length: 5001 }, (_, index) =>
    record({ id: `limit-${index}`, comment: "x", rating: 1 })), UPDATED), /Invalid review snapshot/);
});

test("legacy prepared generations remain readable and upgrade without allowing downgrade", () => {
  const harness = createHarness();
  const modern = plain(harness.context.buildPublicReviews([record()], UPDATED));
  const { reviews, ...legacy } = modern;
  legacy.schemaVersion = 1;
  legacy.featured = legacy.featured.map(({ date, dateType, ...card }) => card);
  harness.context.storeSnapshot_(legacy);
  assert.deepEqual(plain(harness.context.readStoredSnapshot_()), legacy);
  harness.context.storeSnapshot_(modern);
  const before = new Map(harness.propertyData);
  assert.throws(() => harness.context.storeSnapshot_(legacy), /downgrade/);
  assert.deepEqual([...harness.propertyData], [...before]);
  assert.deepEqual(JSON.parse(harness.context.doGet().body), modern);
});

test("two near-200KB generations fit during the atomic switch", () => {
  const harness = createHarness();
  const records = Array.from({ length: 78 }, (_, index) => record({
    id: `near-limit-${index}`, rating: 4, comment: "😀".repeat(600),
  }));
  const first = harness.context.buildPublicReviews(records, UPDATED);
  const size = Buffer.byteLength(JSON.stringify(first));
  assert.ok(size > 190000 && size <= 200000);
  harness.context.storeSnapshot_(first);
  const replacement = { ...plain(first), updatedAt: "2026-10-05T00:00:00Z" };
  harness.context.storeSnapshot_(replacement);
  assert.deepEqual(plain(harness.context.readStoredSnapshot_()), replacement);
  const total = [...harness.propertyData].reduce((sum, [key, value]) =>
    sum + Buffer.byteLength(key) + Buffer.byteLength(value), 0);
  assert.ok(total < 210000);
});

test("public dates use actual source instants in Los Angeles across DST and day boundaries", () => {
  const harness = createHarness();
  const cases = [
    ["2026-10-05T06:59:59.999Z", "2026-10-04"],
    ["2026-10-05T07:00:00.000Z", "2026-10-05"],
    ["2026-01-01T07:59:59.999Z", "2025-12-31"],
    ["2026-01-01T08:00:00.000Z", "2026-01-01"],
    ["2024-03-01T07:59:59.999Z", "2024-02-29"],
    ["2026-03-08T09:59:59.000Z", "2026-03-08"],
    ["2026-03-08T10:00:00.000Z", "2026-03-08"],
    ["2026-11-01T08:30:00.000Z", "2026-11-01"],
    ["2026-11-01T09:30:00.000Z", "2026-11-01"],
  ];
  for (const [timestamp, day] of cases) {
    const snapshot = plain(harness.context.buildPublicReviews([record({ timestamp })], UPDATED));
    assert.equal(snapshot.reviews[0].date, day);
    assert.equal(snapshot.reviews[0].dateType, "submitted");
    assert.deepEqual(snapshot.featured[0], snapshot.reviews[0]);
    assert.equal(harness.formattedDates.at(-1), Date.parse(timestamp));
    assert.doesNotMatch(JSON.stringify(snapshot.reviews), /timestamp|consent|T\d{2}:|source-response/);
    harness.context.storeSnapshot_(snapshot);
    assert.deepEqual(JSON.parse(harness.context.doGet().body), snapshot);
  }
});

test("runtime import map hashes exact original seconds; identical later reposts stay submitted", () => {
  const harness = createHarness();
  const imported = record({ id: "historical-source", comment: "  Historical wording \n", displayName: " Name  ",
    timestamp: "2026-09-29T12:00:00.987-06:00" });
  const fingerprint = publicId(JSON.stringify([5, "Historical wording", "Name", "2026-09-29T18:00:00.000Z"]));
  harness.context.REVIEW_IMPORTED_DATES = { [fingerprint]: "2026-09-29" };
  const snapshot = plain(harness.context.buildPublicReviews([
    imported,
    record({ id: "future-rating", rating: 4, comment: imported.comment, displayName: imported.displayName }),
    record({ id: "future-wording", comment: "Different wording", displayName: imported.displayName }),
    record({ id: "future-name", comment: imported.comment, displayName: "Different Name" }),
    record({ id: "future-identical", comment: imported.comment, displayName: imported.displayName,
      timestamp: "2026-10-05T12:00:00-06:00" }),
    record({ id: "private-date", comment: "Private feedback", consent: false }),
  ], UPDATED));
  const historical = snapshot.reviews.find(review => review.id === publicId(imported.id));
  assert.equal(historical.date, "2026-09-29");
  assert.equal(historical.dateType, "imported");
  assert.equal(historical.comment, imported.comment);
  assert.equal(historical.displayName, imported.displayName);
  assert.ok(snapshot.featured.every(review => snapshot.reviews.some(match => JSON.stringify(match) === JSON.stringify(review))));
  const future = snapshot.reviews.find(review => review.id === publicId("future-identical"));
  assert.equal(future.date, "2026-10-05");
  assert.equal(future.dateType, "submitted");
  assert.ok(snapshot.reviews.filter(review => review.id !== historical.id).every(review => review.dateType === "submitted"));
  assert.equal(harness.formattedDates.length, 4);
  assert.equal(snapshot.ratingCount, 6);
  assert.equal(snapshot.reviews.length, 5);
  assert.equal(JSON.stringify(snapshot).includes(fingerprint), false);
  assert.doesNotMatch(JSON.stringify(snapshot), /historical-source|private-date|Private feedback|T12:00:00|T18:00:00/);
  const equivalent = plain(harness.context.buildPublicReviews([
    { ...imported, timestamp: "2026-09-29T18:00:00.123Z" },
  ], UPDATED));
  assert.equal(equivalent.reviews[0].dateType, "imported");
  assert.deepEqual(equivalent.featured[0], equivalent.reviews[0]);
});

test("invalid mapped calendar days fail refresh before replacing last-good storage", () => {
  const harness = createHarness();
  const initial = harness.context.buildPublicReviews([record()], UPDATED);
  harness.context.storeSnapshot_(initial);
  const before = new Map(harness.propertyData);
  harness.setForm(form([formResponse()]));
  const fingerprint = publicId(JSON.stringify([5, "A precise response from the form.", "Form Reviewer", "2026-09-29T12:00:00.000Z"]));
  for (const date of ["2025-02-29", "1900-02-29", "2100-02-29", "2026-04-31", "0000-01-01",
    "2026-00-01", "2026-13-01", "2026-01-00", "2026-01-32", "2026-9-29", "2026-09-29T00:00:00Z", null]) {
    harness.context.REVIEW_IMPORTED_DATES = { [fingerprint]: date };
    assert.throws(() => harness.context.refreshReviews(), /^Error: Review refresh failed\.$/);
    assert.deepEqual([...harness.propertyData], [...before]);
    assert.deepEqual(plain(harness.context.readStoredSnapshot_()), plain(initial));
  }
});

test("feed validator accepts paired dates and rejects metadata or featured-date drift", () => {
  const { context } = createHarness();
  const snapshot = plain(context.buildPublicReviews([record()], UPDATED));
  const undated = ({ date, dateType, ...review }) => review;
  assert.equal(context.isValidPublicSnapshot_({ ...snapshot, featured: snapshot.featured.map(undated),
    reviews: snapshot.reviews.map(undated) }), true);
  for (const date of ["0001-01-01", "2000-02-29", "2024-02-29", "2400-02-29", "9999-12-31"]) {
    const review = { ...snapshot.reviews[0], date, dateType: "imported" };
    assert.equal(context.isValidPublicSnapshot_({ ...snapshot, featured: [review], reviews: [review] }), true);
  }
  for (const metadata of [
    { date: "2026-09-29" }, { dateType: "submitted" },
    { date: "2026-09-29", dateType: "verified" },
    { date: "2025-02-29", dateType: "submitted" },
    { date: "1900-02-29", dateType: "imported" },
    { date: "2026-09-29", dateType: "submitted", timestamp: "private" },
  ]) {
    const review = { ...undated(snapshot.reviews[0]), ...metadata };
    assert.equal(context.isValidPublicSnapshot_({ ...snapshot, featured: [review], reviews: [review] }), false);
  }
  for (const change of [{ date: "2026-09-28" }, { dateType: "imported" }]) {
    assert.equal(context.isValidPublicSnapshot_({ ...snapshot, featured: [{ ...snapshot.featured[0], ...change }] }), false);
  }
  assert.equal(context.isValidPublicSnapshot_({ ...snapshot, featured: snapshot.featured.map(undated) }), false);
  assert.equal(context.isValidPublicSnapshot_({ ...snapshot, reviews: snapshot.reviews.map(undated) }), false);
});

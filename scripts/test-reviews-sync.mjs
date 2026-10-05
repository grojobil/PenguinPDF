import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isValidReviews } from "../docs/review-data.mjs";
import { isFeedURL, legacyReviews, readPublicFeed, sameReviews, syncReviews, validatePublicFeed } from "./sync-reviews.mjs";

const url = "https://script.google.com/macros/s/QA_FEED/exec";
const empty = { schemaVersion:1, updatedAt:"2026-09-29T12:00:00Z", ratingCount:0, ratingSum:0, featured:[] };
const data = () => ({ ...empty, ratingCount:3, ratingSum:11, featured:[{id:"0000000000000001",rating:5,comment:"QA fixture, not a customer review",displayName:""}] });
const response = (body, options = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { headers:{"content-type":"application/json"}, ...options });

test("cached legacy pages receive compatible ratings while the new UI keeps the full archive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "penguin-compatibility-"));
  try {
    const path = join(directory, "reviews-v2.json");
    const compatibilityPath = join(directory, "reviews.json");
    const review = { ...data().featured[0], date: "2026-10-05", dateType: "submitted" };
    const modern = { ...data(), schemaVersion: 2, featured: [review], reviews: [review] };
    await writeFile(path, JSON.stringify(modern));
    const fetcher = async () => response(modern);
    assert.equal(await syncReviews(url, { path, compatibilityPath, fetcher }), true);
    const legacy = JSON.parse(await readFile(compatibilityPath, "utf8"));
    assert.ok(isValidReviews(legacy));
    assert.equal(legacy.schemaVersion, 1);
    assert.equal(legacy.ratingCount, modern.ratingCount);
    assert.equal(legacy.ratingSum, modern.ratingSum);
    assert.deepEqual(Object.keys(legacy.featured[0]).sort(), ["comment", "displayName", "id", "rating"]);
    assert.equal(await syncReviews(url, { path, compatibilityPath, fetcher }), false);
    const before = await readFile(path, "utf8");
    await assert.rejects(syncReviews(url, { path, compatibilityPath, fetcher: async () => response({}) }));
    assert.equal(await readFile(path, "utf8"), before);
    assert.deepEqual(legacyReviews(modern), legacy);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("feed accepts only the fixed public Apps Script deployment URL", () => {
  assert.ok(isFeedURL(url));
  for (const value of ["http://script.google.com/macros/s/QA/exec", "https://example.com/feed", url+"?raw=true", url+"#secret", "https://user@script.google.com/macros/s/QA/exec", "https://script.google.com/macros/s/QA/dev"]) assert.equal(isFeedURL(value),false);
});

test("snapshot accepts legacy ratings and rejects private fields or infeasible aggregates", () => {
  assert.equal(validatePublicFeed(data()).ratingSum,11);
  assert.throws(() => validatePublicFeed({...data(),featured:[{...data().featured[0],rating:4}]}));
  for (const change of [{timestamp:"private"},{email:"private"},{ratingCount:100},{featured:[{...data().featured[0],consent:true}]},{schemaVersion:3}]) {
    assert.throws(() => validatePublicFeed({...data(),...change}));
  }
});

test("fetch omits credentials and rejects HTML, failures, oversized data and redirects", async () => {
  let options;
  assert.deepEqual(await readPublicFeed(url,async (_, init) => { options=init; return response(data()); }),data());
  assert.equal(options.credentials,"omit");
  assert.ok(options.signal);
  for (const fetcher of [
    async()=>response("not json"),
    async()=>response("error",{status:503}),
    async()=>response("<html>sign in</html>",{headers:{"content-type":"text/html"}}),
    async()=>response("x".repeat(250001)),
    async()=>{throw new Error("offline");},
    async()=>{const result=response(data()); Object.defineProperty(result,"url",{value:"https://example.com/private"}); return result;},
  ]) await assert.rejects(readPublicFeed(url,fetcher));
});

function modernData() {
  const first = data().featured[0];
  return { ...data(), schemaVersion: 2, reviews: [first,
    { id: "0000000000000002", rating: 1, comment: "Needs improvement", displayName: "" }] };
}

test("schema2 sync includes archive changes, timestamp no-ops, and refuses downgrade", async t => {
  const directory = await mkdtemp(join(tmpdir(), "penguin-reviews-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "reviews.json");
  await writeFile(path, JSON.stringify(data()));
  const modern = modernData();
  assert.equal(await syncReviews(url, { path, fetcher: async () => response(modern) }), true);
  const saved = await readFile(path, "utf8");
  assert.equal(await syncReviews(url, { path, fetcher: async () => response({ ...modern, updatedAt: "2026-10-05T00:00:00Z" }) }), false);
  assert.equal(await readFile(path, "utf8"), saved);
  await assert.rejects(syncReviews(url, { path, fetcher: async () => response(data()) }), /downgrade/);
  assert.equal(await readFile(path, "utf8"), saved);
  const changed = { ...modern, reviews: [modern.reviews[0], { ...modern.reviews[1], comment: "Revised criticism" }] };
  assert.equal(sameReviews(modern, changed), false);
  assert.equal(await syncReviews(url, { path, fetcher: async () => response(changed) }), true);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), changed);
});

test("schema2 archive rejects private fields and featured mismatches", () => {
  const modern = modernData();
  assert.deepEqual(validatePublicFeed(modern), modern);
  for (const invalid of [
    { ...modern, reviews: [{ ...modern.reviews[0], timestamp: "private" }] },
    { ...modern, featured: [{ ...modern.featured[0], comment: "Changed" }] },
    { ...modern, reviews: [] },
  ]) assert.throws(() => validatePublicFeed(invalid));
});

test("valid full archives above the old fetch limit are accepted", async () => {
  const reviews = Array.from({ length: 100 }, (_, index) => ({
    id: index.toString(16).padStart(16, "0"), rating: 4, comment: "😀".repeat(300), displayName: "" }));
  const snapshot = { ...empty, schemaVersion: 2, ratingCount: 100, ratingSum: 400, reviews };
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) > 64000);
  assert.deepEqual(await readPublicFeed(url, async () => response(snapshot)), snapshot);
});

test("no-op refreshes do not create timestamp-only commits", () => {
  assert.ok(sameReviews(data(),{...data(),updatedAt:"2026-09-30T12:00:00Z"}));
  assert.equal(sameReviews(empty,data()),false);
});

test("atomic sync writes only public JSON and preserves previous output on failures", async t => {
  const directory=await mkdtemp(join(tmpdir(),"penguin-reviews-"));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,"reviews.json");
  const old=JSON.stringify(empty);
  await writeFile(path,old);
  for (const fetcher of [async()=>response({...data(),private:"do not publish"}),async()=>{throw new Error("offline");}]) {
    await assert.rejects(syncReviews(url,{path,fetcher}));
    assert.equal(await readFile(path,"utf8"),old);
  }
  assert.equal(await syncReviews(url,{path,fetcher:async()=>response(data())}),true);
  assert.deepEqual(JSON.parse(await readFile(path,"utf8")),data());
  const content=await readFile(path,"utf8");
  assert.equal(await syncReviews(url,{path,fetcher:async()=>response({...data(),updatedAt:"2026-09-30T12:00:00Z"})}),false);
  assert.equal(await readFile(path,"utf8"),content);
});

test("sync does not remove a temporary file owned by another operation", async t => {
  const directory = await mkdtemp(join(tmpdir(), "penguin-reviews-"));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const path = join(directory, "reviews.json");
  await writeFile(path, JSON.stringify(empty));
  await writeFile(path + ".sync-tmp", "other operation");
  await assert.rejects(syncReviews(url, { path, fetcher:async()=>response(data()) }), { code:"EEXIST" });
  assert.equal(await readFile(path + ".sync-tmp", "utf8"), "other operation");
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), empty);
});

test("paired dates sync automatically, date-only changes write, and invalid metadata preserves output", async t => {
  const directory = await mkdtemp(join(tmpdir(), "penguin-reviews-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "reviews.json");
  const undated = modernData();
  await writeFile(path, JSON.stringify(undated));
  const reviews = undated.reviews.map((review, index) => ({ ...review,
    date: index === 0 ? "2026-09-29" : "2026-10-05", dateType: index === 0 ? "imported" : "submitted" }));
  const dated = { ...undated, reviews, featured: [reviews[0]] };
  assert.equal(sameReviews(undated, dated), false);
  assert.equal(await syncReviews(url, { path, fetcher: async () => response(dated) }), true);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), dated);
  assert.equal(await syncReviews(url, { path, fetcher: async () => response({ ...dated, updatedAt: "2026-10-06T00:00:00Z" }) }), false);
  const corrected = { ...dated, reviews: [reviews[0], { ...reviews[1], date: "2026-10-04" }] };
  assert.equal(await syncReviews(url, { path, fetcher: async () => response(corrected) }), true);
  const saved = await readFile(path, "utf8");
  for (const invalid of [
    { ...dated, reviews: [reviews[0], { ...reviews[1], date: "2025-02-29" }] },
    { ...dated, featured: [{ ...reviews[0], dateType: "submitted" }] },
    { ...dated, featured: [undated.featured[0]] },
    { ...dated, reviews: [reviews[0], { ...undated.reviews[1], date: "2026-10-05" }] },
  ]) {
    await assert.rejects(syncReviews(url, { path, fetcher: async () => response(invalid) }));
    assert.equal(await readFile(path, "utf8"), saved);
  }
});

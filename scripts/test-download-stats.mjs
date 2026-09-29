import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchReleases, mergeDownloadStats } from "./update-download-stats.mjs";

const asset = (id, count, name = "PenguinPDF_x64-setup.exe") => ({ id, name, download_count: count });
const release = (assets, tag_name = "v2.0.0", extra = {}) => ({ tag_name, assets, ...extra });
const timestamp = "2026-09-29T20:00:00.000Z";

test("only published stable installers count, with platform and release breakdowns", () => {
  const stats = mergeDownloadStats(null, [
    release([asset(1, 11), asset(2, 8, "PenguinPDF-macOS.dmg"), asset(3, 9, "PenguinPDF_x64.msi"), asset(4, 20, "SHA256SUMS.txt")]),
    release([asset(5, 32, "PenguinPDF_x64.dmg")], "v1.0.0"),
    release([asset(6, 50)], "draft", { draft: true }),
    release([asset(7, 50)], "beta", { prerelease: true }),
  ], timestamp);
  assert.equal(stats.total, 60);
  assert.deepEqual(stats.byPlatform, { macOS: 40, Windows: 20 });
  assert.deepEqual(stats.byRelease, { "v2.0.0": 28, "v1.0.0": 32 });
  assert.equal(stats.assets.length, 4);
});

test("repeated snapshots do not double-count and lower API counts cannot erase history", () => {
  const first = mergeDownloadStats(null, [release([asset(1, 11)])], timestamp);
  const repeat = mergeDownloadStats(first, [release([asset(1, 11)])], timestamp);
  assert.equal(repeat.total, 11);
  assert.equal(mergeDownloadStats(repeat, [release([asset(1, 2)])], timestamp).total, 11);
  assert.equal(mergeDownloadStats(repeat, [release([asset(1, 15)])], timestamp).total, 15);
  assert.equal(repeat.startedAt, timestamp);
});

test("replacing assets under the same version retains observed counts", () => {
  const first = mergeDownloadStats(null, [release([asset(1, 11)])], timestamp);
  const replacement = mergeDownloadStats(first, [release([asset(2, 3)])], timestamp);
  assert.equal(replacement.total, 14);
  assert.equal(replacement.byRelease["v2.0.0"], 14);
  assert.equal(replacement.assets.length, 2);
  assert.equal(first.assets.length, 1, "input is not mutated");
});

test("invalid or empty responses fail instead of publishing zero or partial totals", () => {
  for (const count of [-1, 1.5, NaN, "11"]) {
    assert.throws(() => mergeDownloadStats(null, [release([asset(1, count)])], timestamp));
  }
  assert.throws(() => mergeDownloadStats(null, [], timestamp));
  assert.throws(() => mergeDownloadStats(null, {}, timestamp));
  assert.throws(() => mergeDownloadStats(null, [release([asset(1, 2), asset(1, 3)])], timestamp));
  assert.throws(() => mergeDownloadStats({ schemaVersion: 2, assets: [] }, [release([asset(1, 2)])], timestamp));
  assert.throws(() => mergeDownloadStats({ schemaVersion: 1, startedAt: timestamp, assets: [{ id: 1, downloads: "10" }] }, [release([asset(1, 2)])], timestamp));
  assert.throws(() => mergeDownloadStats({ schemaVersion: 1, startedAt: timestamp, assets: [{ id: 1, downloads: 10, name: "not-an-installer", platform: null, release: "v1" }] }, [release([asset(2, 2)])], timestamp));
});

test("all release pages are fetched and a later-page failure is not partial success", async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(url);
    return { ok: true, json: async () => urls.length === 1 ? Array.from({ length: 100 }, () => release([])) : [release([asset(1, 2)])] };
  };
  assert.equal((await fetchReleases(fetcher, "")).length, 101);
  assert.match(urls[1], /page=2$/);
  let calls = 0;
  await assert.rejects(fetchReleases(async () => ++calls === 1
    ? { ok: true, json: async () => Array.from({ length: 100 }, () => release([])) }
    : { ok: false, status: 403 }, ""), /403/);
});

test("invalid history timestamps and unsafe totals fail, and release tags are plain data", () => {
  const first = mergeDownloadStats(null, [release([asset(1, 2)])], timestamp);
  assert.throws(() => mergeDownloadStats({ ...first, startedAt: "invalid" }, [release([asset(1, 3)])], timestamp));
  assert.throws(() => mergeDownloadStats(null, [release([asset(1, Number.MAX_SAFE_INTEGER), asset(2, 1)])], timestamp));
  const special = mergeDownloadStats(null, [release([asset(1, 3)], "__proto__")], timestamp);
  assert.equal(Object.hasOwn(special.byRelease, "__proto__"), true);
  assert.equal(special.byRelease["__proto__"], 3);
});

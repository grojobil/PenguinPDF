import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isValidReviews } from "../docs/review-data.mjs";

const snapshotPath = new URL("../docs/reviews-v2.json", import.meta.url);
const legacyPath = new URL("../docs/reviews.json", import.meta.url);
const configPath = new URL("reviews-feed.json", import.meta.url);
const MAX_BYTES = 250000;

export function validatePublicFeed(data) {
  if (!isValidReviews(data) || !data.featured.every(review => review.rating === 5)) {
    throw new Error("Invalid public reviews feed; previous website data retained.");
  }
  return data;
}

export function isFeedURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "script.google.com" &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname);
  } catch { return false; }
}

export async function readPublicFeed(url, fetcher = fetch) {
  if (!isFeedURL(url)) throw new Error("Expected the configured public Google Apps Script feed URL.");
  const response = await fetcher(url, { credentials: "omit", signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("Reviews feed unavailable; previous website data retained.");
  }
  const finalURL = new URL(response.url || url);
  if (finalURL.protocol !== "https:" || !["script.google.com", "script.googleusercontent.com"].includes(finalURL.hostname)) {
    throw new Error("Unexpected reviews feed redirect; previous website data retained.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) throw new Error("Reviews feed too large; previous website data retained.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  try {
    return validatePublicFeed(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
  } catch {
    throw new Error("Invalid public reviews feed; previous website data retained.");
  }
}

export function sameReviews(left, right) {
  return left?.schemaVersion === right.schemaVersion &&
    left?.ratingCount === right.ratingCount && left?.ratingSum === right.ratingSum &&
    JSON.stringify(left?.featured) === JSON.stringify(right.featured) &&
    JSON.stringify(left?.reviews) === JSON.stringify(right.reviews);
}

export function legacyReviews(data) {
  return { schemaVersion: 1, updatedAt: data.updatedAt, ratingCount: data.ratingCount, ratingSum: data.ratingSum,
    featured: data.featured.map(({ id, rating, comment, displayName }) => ({ id, rating, comment, displayName })) };
}

async function writeAtomic(path, data) {
  const temporary = (path instanceof URL ? fileURLToPath(path) : resolve(path)) + ".sync-tmp";
  let created = false;
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
    created = true;
    await rename(temporary, path);
  } finally {
    if (created) await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}

export async function syncReviews(url, { path = snapshotPath, compatibilityPath = path === snapshotPath ? legacyPath : null, fetcher = fetch } = {}) {
  const data = await readPublicFeed(url, fetcher);
  const previous = JSON.parse(await readFile(path, "utf8"));
  if (!isValidReviews(previous)) throw new Error("Existing website reviews need repair; no data replaced.");
  if (previous.schemaVersion === 2 && data.schemaVersion === 1) {
    throw new Error("Reviews feed downgrade refused; previous website archive retained.");
  }
  let compatibility;
  let compatibilityChanged = false;
  if (compatibilityPath) {
    compatibility = legacyReviews(data);
    const existing = await readFile(compatibilityPath, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; });
    const parsed = existing ? JSON.parse(existing) : null;
    if (parsed && !isValidReviews(parsed)) throw new Error("Existing compatibility reviews need repair; no data replaced.");
    compatibilityChanged = !parsed || !sameReviews(parsed, compatibility);
  }
  const changed = !sameReviews(previous, data);
  if (!changed && !compatibilityChanged) return false;
  if (changed) await writeAtomic(path, data);
  if (compatibilityChanged) await writeAtomic(compatibilityPath, compatibility);
  return changed || compatibilityChanged;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const url = process.env.REVIEWS_FEED_URL || JSON.parse(await readFile(configPath, "utf8")).url;
    const changed = await syncReviews(url);
    console.log(changed ? "Updated the public reviews snapshot." : "No review changes; nothing rewritten.");
  } catch (error) {
    console.error(error.code === "ENOENT" ? "Reviews feed is not configured; previous website data retained." : error.message);
    process.exitCode = 1;
  }
}

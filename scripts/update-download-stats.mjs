import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const statsPath = new URL("../docs/downloads.json", import.meta.url);
const repository = "grojobil/PenguinPDF";
const appStoreLookup = "https://itunes.apple.com/lookup?id=6830822105&country=us";

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validAppStoreDownloads(value) {
  if (!validCount(value?.total) || !/^\d{4}-\d{2}-\d{2}$/.test(value.through)) return false;
  const date = new Date(`${value.through}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.through;
}

export function readAppStoreDownloadInput(count = "", through = "") {
  if (!count && !through) return undefined;
  const value = { total: Number(count), through };
  if (!/^\d+$/.test(count) || !validAppStoreDownloads(value)) {
    throw new Error("Provide a cumulative App Store download count and a valid YYYY-MM-DD report end date");
  }
  return value;
}

function validAppStoreRating(value) {
  return validCount(value?.count) && Number.isFinite(value.average) &&
    (value.count === 0 ? value.average === 0 : value.average >= 1 && value.average <= 5) &&
    value.storefront === "US" && typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt));
}

export async function fetchAppStoreRating(fetcher = fetch, now = new Date().toISOString()) {
  const response = await fetcher(appStoreLookup, {
    credentials: "omit",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`App Store rating lookup failed (${response.status})`);
  const data = await response.json();
  const app = data?.results?.[0];
  if (data?.resultCount !== 1 || !Array.isArray(data.results) || data.results.length !== 1 || app?.trackId !== 6830822105) {
    throw new Error("App Store rating lookup did not return PenguinPDF");
  }
  const result = {
    count: app.userRatingCount,
    average: app.averageUserRating ?? (app.userRatingCount === 0 ? 0 : undefined),
    storefront: "US",
    updatedAt: now,
  };
  if (!validAppStoreRating(result)) throw new Error("Invalid App Store rating data");
  return result;
}

function installerPlatform(name) {
  if (!/^PenguinPDF.*\.(dmg|exe|msi)$/i.test(name)) return null;
  return /\.dmg$/i.test(name) ? "macOS" : "Windows";
}

export function mergeDownloadStats(previous, releases, now = new Date().toISOString(), { appStoreDownloads, appStoreRating } = {}) {
  if (!Number.isFinite(Date.parse(now))) throw new Error("Invalid snapshot timestamp");
  if (!Array.isArray(releases)) throw new Error("Invalid GitHub releases response");
  if (previous && (previous.schemaVersion !== 1 || !Array.isArray(previous.assets) ||
      typeof previous.startedAt !== "string" || !Number.isFinite(Date.parse(previous.startedAt)))) {
    throw new Error("Invalid saved download statistics; refusing to reset history");
  }
  const store = appStoreDownloads ?? previous?.appStoreDownloads;
  const rating = appStoreRating ?? previous?.appStoreRating;
  if (store !== undefined && (!validAppStoreDownloads(store) || store.through > new Date(now).toISOString().slice(0, 10))) {
    throw new Error("Invalid App Store download snapshot");
  }
  if (appStoreDownloads && previous?.appStoreDownloads && store.through < previous.appStoreDownloads.through) {
    throw new Error("Cannot replace App Store downloads with an older report");
  }
  if (rating !== undefined && !validAppStoreRating(rating)) throw new Error("Invalid App Store rating snapshot");
  const assets = new Map();
  for (const asset of previous?.assets ?? []) {
    if (!Number.isSafeInteger(asset.id) || asset.id <= 0 ||
        !Number.isSafeInteger(asset.downloads) || asset.downloads < 0 ||
        !["macOS", "Windows"].includes(asset.platform) ||
        installerPlatform(asset.name) !== asset.platform || typeof asset.release !== "string") {
      throw new Error("Invalid saved asset; refusing to reset history");
    }
    if (assets.has(asset.id)) throw new Error("Duplicate saved asset");
    assets.set(asset.id, { ...asset });
  }
  let observed = 0;
  const seen = new Set();
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    if (typeof release.tag_name !== "string" || !Array.isArray(release.assets)) {
      throw new Error("Incomplete GitHub release data");
    }
    for (const asset of release.assets) {
      const platform = installerPlatform(asset.name);
      if (!platform) continue;
      if (!Number.isSafeInteger(asset.id) || asset.id <= 0 || seen.has(asset.id) ||
          !Number.isSafeInteger(asset.download_count) || asset.download_count < 0) {
        throw new Error("Invalid GitHub installer data");
      }
      seen.add(asset.id);
      observed++;
      const old = assets.get(asset.id);
      assets.set(asset.id, {
        id: asset.id,
        name: asset.name,
        release: release.tag_name,
        platform,
        downloads: Math.max(old?.downloads ?? 0, asset.download_count),
      });
    }
  }
  if (!observed) throw new Error("No published installers found; refusing to replace statistics");
  const byPlatform = { macOS: 0, Windows: 0 };
  const releaseCounts = new Map();
  for (const asset of assets.values()) {
    byPlatform[asset.platform] += asset.downloads;
    releaseCounts.set(asset.release, (releaseCounts.get(asset.release) ?? 0) + asset.downloads);
  }
  const total = byPlatform.macOS + byPlatform.Windows + (store?.total ?? 0);
  if (!Number.isSafeInteger(total)) throw new Error("Download total exceeds the supported range");
  return {
    schemaVersion: 1,
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    total,
    byPlatform,
    byRelease: Object.fromEntries(releaseCounts),
    assets: [...assets.values()].sort((a, b) => a.id - b.id),
    ...(store ? { appStoreDownloads: { total: store.total, through: store.through } } : {}),
    ...(rating ? { appStoreRating: { count: rating.count, average: rating.average, storefront: rating.storefront, updatedAt: rating.updatedAt } } : {}),
  };
}

export async function fetchReleases(fetcher = fetch, token = process.env.GITHUB_TOKEN) {
  const releases = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetcher(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GitHub release lookup failed (${response.status})`);
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error("Invalid GitHub releases response");
    releases.push(...items);
    if (items.length < 100) return releases;
  }
  throw new Error("Release pagination exceeded the supported range");
}

async function update() {
  let previous;
  try {
    previous = JSON.parse(await readFile(statsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const appStoreDownloads = readAppStoreDownloadInput(process.env.APP_STORE_DOWNLOADS, process.env.APP_STORE_DOWNLOADS_THROUGH);
  const releases = await fetchReleases();
  const appStoreRating = await fetchAppStoreRating().catch(() => {
    console.warn("App Store rating lookup failed; preserving the last verified rating");
    return undefined;
  });
  const next = mergeDownloadStats(previous, releases, new Date().toISOString(), { appStoreDownloads, appStoreRating });
  const temporaryPath = new URL("../docs/downloads.json.tmp", import.meta.url);
  await writeFile(temporaryPath, JSON.stringify(next, null, 2) + "\n");
  await rename(temporaryPath, statsPath);
  console.log(`${next.total} recorded downloads (macOS ${next.byPlatform.macOS}, Windows ${next.byPlatform.Windows}, App Store ${next.appStoreDownloads?.total ?? "not reported"})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  update().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

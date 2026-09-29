import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const statsPath = new URL("../docs/downloads.json", import.meta.url);
const repository = "grojobil/PenguinPDF";

function installerPlatform(name) {
  if (!/^PenguinPDF.*\.(dmg|exe|msi)$/i.test(name)) return null;
  return /\.dmg$/i.test(name) ? "macOS" : "Windows";
}

export function mergeDownloadStats(previous, releases, now = new Date().toISOString()) {
  if (!Number.isFinite(Date.parse(now))) throw new Error("Invalid snapshot timestamp");
  if (!Array.isArray(releases)) throw new Error("Invalid GitHub releases response");
  if (previous && (previous.schemaVersion !== 1 || !Array.isArray(previous.assets) ||
      typeof previous.startedAt !== "string" || !Number.isFinite(Date.parse(previous.startedAt)))) {
    throw new Error("Invalid saved download statistics; refusing to reset history");
  }
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
  const total = byPlatform.macOS + byPlatform.Windows;
  if (!Number.isSafeInteger(total)) throw new Error("Download total exceeds the supported range");
  return {
    schemaVersion: 1,
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    total,
    byPlatform,
    byRelease: Object.fromEntries(releaseCounts),
    assets: [...assets.values()].sort((a, b) => a.id - b.id),
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
  const next = mergeDownloadStats(previous, await fetchReleases());
  const temporaryPath = new URL("../docs/downloads.json.tmp", import.meta.url);
  await writeFile(temporaryPath, JSON.stringify(next, null, 2) + "\n");
  await rename(temporaryPath, statsPath);
  console.log(`${next.total} recorded installer downloads (macOS ${next.byPlatform.macOS}, Windows ${next.byPlatform.Windows})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  update().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

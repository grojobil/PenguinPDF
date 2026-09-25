import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, Script } from "node:vm";

const site = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const siteScript = site.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const base = "https://github.com/grojobil/PenguinPDF/releases/download/v2.0.0/";
const assets = [
  "PenguinPDF-2.0.0-macOS-Apple-Silicon.dmg",
  "PenguinPDF-2.0.0-macOS-Intel.dmg",
  "PenguinPDF_x64-setup.exe",
  "PenguinPDF_x64_en-US.msi",
];

test("all v2 installer URLs are visible links on the site and in README", () => {
  const choices = site.match(/<nav class="downloadOptions"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(choices, "missing no-JS download choices");
  for (const asset of assets) {
    const url = base + asset;
    assert.ok(choices.includes(`href="${url}"`), `site: ${asset}`);
    assert.ok(readme.includes(`](${url})`), `README: ${asset}`);
  }
});

test("the primary action defaults to choices, except for Windows EXE", () => {
  assert.match(site, /id="downloadBtn" href="#download-options"/);
  assert.match(site, /win: "https:\/\/github\.com\/grojobil\/PenguinPDF\/releases\/download\/v2\.0\.0\/PenguinPDF_x64-setup\.exe"/);
  assert.match(site, /if \(isWindows\(\)\) return DOWNLOADS\.win;\s*return DOWNLOADS\.choices;/);
  assert.doesNotMatch(site, /function isMacOS\(|DOWNLOADS\.mac/);
  assert.match(site, /Android\|iPhone\|iPad\|iPod\|Mobile/);
});

test("site script parses", () => {
  assert.ok(siteScript);
  assert.doesNotThrow(() => new Script(siteScript));
});

function runSite(userAgent, blockedStorage = false) {
  const element = () => ({
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    getAttribute() { return null; },
    setAttribute() {},
    focus() {},
  });
  const downloadButton = element();
  const downloadLabel = { textContent: "", getAttribute: () => "download_button" };
  let onReady;
  const document = {
    documentElement: { style: { setProperty() {} }, setAttribute() {} },
    getElementById: (id) => id === "downloadBtn" ? downloadButton : element(),
    querySelector: (selector) => selector === "#downloadBtn [data-i18n]" ? downloadLabel : element(),
    querySelectorAll: (selector) => selector === "[data-i18n]" ? [downloadLabel] : [],
    addEventListener: (event, callback) => { if (event === "DOMContentLoaded") onReady = callback; },
  };
  const localStorage = {
    getItem() { if (blockedStorage) throw new Error("storage blocked"); return null; },
    setItem() { if (blockedStorage) throw new Error("storage blocked"); },
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    location: { search: "" },
    addEventListener() {},
    requestAnimationFrame() {},
  };
  const context = createContext({
    document, window, localStorage, URLSearchParams,
    navigator: { userAgent, platform: "", language: "en-US" },
  });
  new Script(siteScript).runInContext(context);
  onReady();
  return { context, downloadButton, downloadLabel };
}

test("desktop Windows downloads EXE; Mac and mobile show choices", () => {
  assert.equal(runSite("Mozilla/5.0 (Windows NT 10.0; Win64; x64)").downloadButton.href, base + "PenguinPDF_x64-setup.exe");
  assert.equal(runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)").downloadButton.href, "#download-options");
  assert.equal(runSite("Mozilla/5.0 (Windows Phone; Mobile)").downloadButton.href, "#download-options");
  assert.equal(runSite("Mozilla/5.0 (iPhone; CPU iPhone OS)").downloadButton.href, "#download-options");
});

test("language switching survives blocked localStorage", () => {
  const { context, downloadLabel } = runSite("Mozilla/5.0 (Macintosh)", true);
  new Script('applyLanguage("es")').runInContext(context);
  assert.equal(downloadLabel.textContent, "Elegir una descarga");
});

test("links and copy do not point to the old or moving release", () => {
  assert.doesNotMatch(site + readme, /releases\/latest|PenguinPDF_x64\.dmg/);
  for (const source of [site, readme]) {
    assert.match(source, /LICENSE\.md/);
    assert.match(source, /THIRD_PARTY_LICENSES\.md/);
    assert.match(source, /penguin\.pdf\.tools@gmail\.com/);
  }
});

test("English and Spanish include v2, Edit, and all download labels", () => {
  assert.match(site, /Version 2\.0\.0/);
  assert.match(site, /Versión 2\.0\.0/);
  assert.match(site, /Edit text, annotate/);
  assert.match(site, /Edita texto, anota/);
  for (const key of ["download_button", "download_windows", "mac_apple", "mac_intel", "win_exe", "win_msi"]) {
    assert.equal(site.match(new RegExp(`\\b${key}:`, "g"))?.length, 2, key);
  }
});

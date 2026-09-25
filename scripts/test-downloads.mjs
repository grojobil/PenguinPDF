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

test("browser tabs use the multi-size Windows penguin without changing the touch icon", () => {
  assert.match(site, /<link rel="icon" type="image\/vnd\.microsoft\.icon" href="assets\/favicon-v2\.ico" \/>/);
  assert.match(site, /<link rel="apple-touch-icon" href="assets\/app-icon\.png" \/>/);
  const icon = readFileSync(new URL("../docs/assets/favicon-v2.ico", import.meta.url));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const sizes = [];
  for (let i = 0; i < icon.readUInt16LE(4); i++) {
    const entry = 6 + i * 16;
    const width = icon[entry] || 256;
    const height = icon[entry + 1] || 256;
    assert.equal(width, height);
    assert.ok(icon.readUInt32LE(entry + 12) + icon.readUInt32LE(entry + 8) <= icon.length);
    sizes.push(width);
  }
  for (const size of [16, 32, 48, 256]) assert.ok(sizes.includes(size), `missing ${size}px icon`);
});

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

test("gallery uses four uncropped, progressively enhanced screenshot links", () => {
  const gallery = site.match(/<section class="shots" id="screenshotCarousel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(gallery, "missing screenshot carousel");

  const expectedSlides = [
    "assets/text-v2.png",
    "assets/fill-v2.png",
    "assets/edit-v2.png",
    "assets/home-v2.png",
  ];
  const slideLinks = [...gallery.matchAll(/<a class="shotCard" href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(slideLinks, expectedSlides);
  for (const asset of expectedSlides) {
    const png = readFileSync(new URL(`../docs/${asset}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG", asset);
    assert.equal(png.readUInt32BE(16), 3024, `${asset} width`);
    assert.equal(png.readUInt32BE(20), 1792, `${asset} height`);
    assert.match(gallery, new RegExp(`<img src="${asset.replace(".", "\\.")}" width="3024" height="1792"`));
  }

  assert.equal(gallery.match(/class="shotPanel" role="group"/g)?.length, 4);
  assert.deepEqual([...gallery.matchAll(/class="shotCounter" aria-hidden="true">(\d \/ 4)</g)].map((match) => match[1]), [
    "1 / 4", "2 / 4", "3 / 4", "4 / 4",
  ]);
  assert.match(gallery, /id="carouselPrev"[\s\S]*?data-i18n-aria-label="previous_screenshot" hidden/);
  assert.match(gallery, /id="carouselNext"[\s\S]*?data-i18n-aria-label="next_screenshot" hidden/);
  assert.match(site, /\.shotCard\{[\s\S]*?aspect-ratio:3024 \/ 1792;/);
  assert.match(site, /\.shotCard img\{[\s\S]*?object-fit:contain;/);
  assert.match(site, /\.carouselArrow\{[\s\S]*?min-width:44px;[\s\S]*?min-height:44px;/);
  assert.doesNotMatch(site, /class="shotTabs"|class="shotTab"|role="tablist"|role="tabpanel"/);
});

test("carousel and lightbox support bounded keyboard navigation without autoplay", () => {
  const { context } = runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
  const keyIndex = (key, current) => new Script(`getShotIndexForKey(${JSON.stringify(key)}, ${current}, 4)`).runInContext(context);
  assert.equal(keyIndex("ArrowRight", 3), 0);
  assert.equal(keyIndex("ArrowLeft", 0), 3);
  assert.equal(keyIndex("Home", 2), 0);
  assert.equal(keyIndex("End", 1), 3);
  assert.equal(keyIndex("Enter", 1), undefined);
  assert.match(siteScript, /screenshotCarousel\.addEventListener\("keydown"/);
  assert.match(siteScript, /imgOverlay\.addEventListener\("keydown"/);
  assert.match(site, /id="lightboxPrev"[\s\S]*?id="lightboxNext"/);
  assert.match(site, /\.imageDialog::backdrop\{\s*background:rgba\(250,247,251,0\.80\)/);
  assert.doesNotMatch(siteScript, /setInterval|setTimeout/);
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

test("English and Spanish include the gallery and download labels without a version badge", () => {
  assert.doesNotMatch(site, /class="versionLabel"|\.versionLabel\{|\bversion_label:/);
  assert.match(site, /<meta name="description" content="PenguinPDF 2\.0\.0:/);
  assert.match(site, /Edit text, annotate/);
  assert.match(site, /Edita texto, anota/);
  for (const key of [
    "download_button", "download_windows", "mac_apple", "mac_intel", "win_exe", "win_msi",
    "screenshots_label", "previous_screenshot", "next_screenshot",
    "slide_1_of_4", "slide_2_of_4", "slide_3_of_4", "slide_4_of_4",
    "shot_text", "shot_fill", "shot_edit", "shot_home",
    "alt_text", "alt_fill", "alt_edit", "alt_home",
  ]) {
    assert.equal(site.match(new RegExp(`\\b${key}:`, "g"))?.length, 2, key);
  }
});

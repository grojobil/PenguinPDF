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

test("all release installers remain available without cluttering the hero", () => {
  const hero = site.match(/<div class="hero">[\s\S]*?<section class="shots"/)?.[0];
  assert.ok(hero);
  assert.doesNotMatch(hero.replace(/<noscript>[\s\S]*?<\/noscript>/g, ""), /class="downloadOptions"/);
  for (const asset of assets) {
    const url = base + asset;
    assert.ok(site.includes(`href="${url}"`), `site: ${asset}`);
    assert.ok(readme.includes(`](${url})`), `README: ${asset}`);
  }
  assert.match(site, /<dialog[^>]+download/i);
});

test("download copy is concise and the Windows notice stays accurate", () => {
  assert.doesNotMatch(site, /Choose a download|Elegir una descarga|macos_info|macos_tooltip/);
  assert.match(site, /Download for macOS/);
  assert.match(site, /Download for Windows/);
  assert.match(site, /More info/);
  assert.match(site, /Run anyway/);
  assert.match(site, /not (?:code[- ]?)?signed|unsigned/i);
  assert.match(site, /Free\. Fully local\./);
});

test("site script parses", () => {
  assert.ok(siteScript);
  assert.doesNotThrow(() => new Script(siteScript));
});

test("gallery retains four genuine screenshot links and uses dots instead of captions", () => {
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

  assert.equal(gallery.match(/class="shotPanel"/g)?.length, 4);
  assert.match(gallery, /id="carouselPrev"/);
  assert.match(gallery, /id="carouselNext"/);
  assert.match(gallery, /carouselDots/);
  assert.doesNotMatch(gallery, /class="shotMeta"|class="shotCounter"/);
  assert.doesNotMatch(site, /class="shotTabs"|class="shotTab"/);
  assert.match(site, /prefers-reduced-motion: reduce/);
  assert.equal(gallery.match(/class="screenshotChrome"/g)?.length, 4);
  assert.match(site, /\.carouselReady \.shotPanel\.is-offstage\{[^}]*visibility:hidden/);
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
  assert.doesNotMatch(siteScript, /setInterval/);
});

function runSite(userAgent, blockedStorage = false, maxTouchPoints = 0) {
  const element = (id = "") => ({
    id, hidden: false, open: false, dataset: {}, style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    getAttribute() { return null; },
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return element(); },
    querySelectorAll() { return []; },
    contains() { return false; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    focus() {},
  });
  const downloadButton = element("downloadBtn");
  const downloadLabel = { textContent: "", getAttribute: () => "download_button" };
  downloadButton.querySelector = () => downloadLabel;
  const elements = new Map([["downloadBtn", downloadButton]]);
  let onReady;
  const document = {
    documentElement: { style: { setProperty() {} }, setAttribute() {} },
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    },
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
    navigator: { userAgent, platform: "", language: "en-US", maxTouchPoints },
  });
  new Script(siteScript).runInContext(context);
  onReady?.();
  return { context, downloadButton, downloadLabel };
}

test("Windows downloads EXE directly without guessing a Mac architecture", () => {
  assert.equal(runSite("Mozilla/5.0 (Windows NT 10.0; Win64; x64)").downloadButton.href, base + "PenguinPDF_x64-setup.exe");
  assert.ok(!runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)").downloadButton.href.endsWith(".dmg"));
});

test("platform routing distinguishes desktop Windows and Mac from mobile and unknown platforms", () => {
  const cases = [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0, "windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0, "mac"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5, "other"],
    ["Mozilla/5.0 (Windows Phone; Mobile)", 5, "other"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS)", 5, "other"],
    ["Mozilla/5.0 (iPad; CPU OS)", 5, "other"],
    ["Mozilla/5.0 (Linux; Android 15)", 5, "other"],
    ["Mozilla/5.0 (X11; Linux x86_64)", 0, "other"],
    ["", 0, "other"],
  ];
  for (const [ua, touches, expected] of cases) {
    const { context } = runSite(ua, false, touches);
    assert.equal(new Script(`getDownloadPlatform(${JSON.stringify(ua)}, ${touches})`).runInContext(context), expected, ua);
  }
});

test("only one previous and one next screenshot are exposed for galleries of any size", () => {
  const { context } = runSite("Mozilla/5.0 (Macintosh)");
  for (const total of [3, 4, 5, 8]) {
    for (let active = 0; active < total; active++) {
      const slots = Array.from({ length: total }, (_, index) =>
        new Script(`getShotSlot(${index}, ${active}, ${total})`).runInContext(context));
      for (const slot of ["active", "prev", "next"]) {
        assert.equal(slots.filter(value => value === slot).length, 1, `${total} slides, active ${active}: ${slot}`);
      }
      assert.equal(slots.filter(value => value === "offstage").length, total - 3);
    }
  }
});

test("modified links keep normal browser navigation", () => {
  const { context } = runSite("Mozilla/5.0 (Macintosh)");
  for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) {
    assert.equal(new Script(`isModifiedLinkClick({${modifier}:true,button:0})`).runInContext(context), true);
  }
  assert.equal(new Script("isModifiedLinkClick({button:1})").runInContext(context), true);
  assert.equal(new Script("Boolean(isModifiedLinkClick({button:0}))").runInContext(context), false);
});

test("language switching survives blocked localStorage", () => {
  const { context, downloadLabel } = runSite("Mozilla/5.0 (Macintosh)", true);
  new Script('applyLanguage("es")').runInContext(context);
  assert.equal(downloadLabel.textContent, "Descargar para macOS");
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
  for (const key of [
    "download_button", "download_windows", "download_mac", "mac_apple", "mac_intel", "win_exe", "win_msi",
    "screenshots_label", "previous_screenshot", "next_screenshot",
    "slide_1_of_4", "slide_2_of_4", "slide_3_of_4", "slide_4_of_4",
    "shot_text", "shot_fill", "shot_edit", "shot_home",
    "alt_text", "alt_fill", "alt_edit", "alt_home",
  ]) {
    assert.equal(site.match(new RegExp(`\\b${key}:`, "g"))?.length, 2, key);
  }
});

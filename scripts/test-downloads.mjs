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

function getElementMarkup(tag, id) {
  const markup = site.match(new RegExp(`<${tag}\\b(?=[^>]*\\bid="${id}")[^>]*>[\\s\\S]*?<\\/${tag}>`))?.[0];
  assert.ok(markup, `missing ${tag}#${id}`);
  return markup;
}

function evaluateJson(context, expression) {
  return JSON.parse(new Script(`JSON.stringify(${expression})`).runInContext(context));
}

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
  assert.match(site, /Free · Fully local/);
});

test("hero separates capabilities from free and local benefits in both languages", () => {
  assert.match(site, /class="heroDesc" data-i18n="hero_desc">Edit, convert, and sign PDFs\.<\/div>/);
  assert.match(site, /class="heroBenefits" data-i18n="hero_benefits">Free · Fully local<\/div>/);
  const { context } = runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
  assert.equal(new Script('I18N.en.hero_desc').runInContext(context), "Edit, convert, and sign PDFs.");
  assert.equal(new Script('I18N.es.hero_desc').runInContext(context), "Edita, convierte y firma PDFs.");
  assert.equal(new Script('I18N.en.hero_benefits').runInContext(context), "Free · Fully local");
  assert.equal(new Script('I18N.es.hero_benefits').runInContext(context), "Gratis · Todo en tu equipo");
  assert.equal(new Script('I18N.en.slide_1_of_4').runInContext(context), "Slide 1 of 4: All tools");
  assert.equal(new Script('I18N.es.slide_1_of_4').runInContext(context), "Captura 1 de 4: Todas las herramientas");
});

test("Mac downloads use a compact light popover with explicit architecture choices", () => {
  const dialog = getElementMarkup("dialog", "macDownloadDialog");
  const openingTag = dialog.match(/^<dialog\b[^>]*>/)?.[0];
  const classes = openingTag?.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) ?? [];
  assert.ok(classes.includes("downloadDialog"));
  assert.ok(classes.includes("macDownloadPopover"));

  const backdrop = site.match(/\.macDownloadPopover::backdrop\s*\{([^}]*)\}/)?.[1];
  assert.ok(backdrop, "missing Mac popover backdrop rule");
  const background = backdrop.match(/\bbackground:\s*([^;]+)/)?.[1].trim();
  assert.ok(background, "missing Mac popover backdrop color");
  if (background !== "transparent") {
    const rgba = background.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    assert.ok(rgba, `unexpected Mac backdrop color: ${background}`);
    assert.ok(rgba.slice(1, 4).every(channel => Number(channel) >= 240), `Mac backdrop is not light: ${background}`);
    if (rgba[4] !== undefined) assert.ok(Number(rgba[4]) <= 0.25, `Mac backdrop is too opaque: ${background}`);
  }
  assert.match(backdrop, /(?:-webkit-)?backdrop-filter:\s*none/);
  assert.doesNotMatch(backdrop, /blur\(/);

  const choices = [
    ["macAppleDownload", assets[0], "Apple Silicon", "mac_apple_detail"],
    ["macIntelDownload", assets[1], "Intel Mac", "mac_intel_detail"],
  ];
  for (const [id, asset, visibleLabel, detailKey] of choices) {
    const choice = getElementMarkup("a", id);
    const openingChoice = choice.match(/^<a\b[^>]*>/)?.[0];
    assert.ok(openingChoice.includes(`href="${base + asset}"`), `${id} has the wrong release URL`);
    const visibleText = choice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(visibleText.includes(visibleLabel), `${id} is missing visible ${visibleLabel} copy`);
    assert.match(choice, new RegExp(`\\bdata-i18n="${detailKey}"`));
    assert.match(choice, /class="macDevice"/, `${id} is missing a recognizable computer icon`);
    assert.ok((choice.match(/<svg\b/g) ?? []).length >= 2, `${id} needs device and chevron icons`);
    assert.doesNotMatch(choice, /macChip|x86|<span>M<\/span>/);
  }

  assert.match(dialog, /\bid="macAllDownloads"/);
  assert.match(dialog, /class="deviceAppleLogo"/);
  assert.match(dialog, /class="intelLabel">Intel<\/span>/);
  assert.match(dialog, /<img\b[^>]*\bsrc="assets\/apple\.png"[^>]*\baria-hidden="true"/);
  assert.doesNotMatch(dialog, /\brecommended\b|\brecomendad[oa]\b/i);
  assert.doesNotMatch(siteScript, /navigator\.userAgentData|getHighEntropyValues|detectMac(?:Cpu|Architecture)/i);
});

test("site script parses", () => {
  assert.ok(siteScript);
  assert.doesNotThrow(() => new Script(siteScript));
});

test("gallery retains four genuine screenshot links and uses dots instead of captions", () => {
  const gallery = site.match(/<section class="shots" id="screenshotCarousel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(gallery, "missing screenshot carousel");

  const expectedSlides = [
    "assets/home-v2.png",
    "assets/text-v2.png",
    "assets/fill-v2.png",
    "assets/edit-v2.png",
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

  const panelRule = site.match(/\.carouselReady \.shotPanel\{([^}]*)\}/)?.[1];
  const transform = panelRule?.match(/\btransform:\s*([^;]+)/)?.[1];
  assert.ok(transform, "missing carousel panel transform");
  assert.ok(transform.includes("perspective(1600px)"), "carousel transform is missing perspective");
  assert.ok(transform.includes("rotateY(var(--slot-yaw))"), "carousel transform is missing Y-axis rotation");
  assert.ok(transform.indexOf("perspective(1600px)") < transform.indexOf("rotateY(var(--slot-yaw))"));
  assert.doesNotMatch(site, /--slot-rotation/);
  assert.match(site, /\.carouselReady \.shotPanel\.is-prev\{[^}]*--slot-yaw:\s*12deg/);
  assert.match(site, /\.carouselReady \.shotPanel\.is-next\{[^}]*--slot-yaw:\s*-12deg/);
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

test("each page load centers Home even after navigating away from it", () => {
  const firstVisit = runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
  const activeImage = visit => new Script('shotCards[activeShotIndex].getAttribute("data-img")').runInContext(visit.context);
  assert.equal(activeImage(firstVisit), "assets/home-v2.png");
  firstVisit.getElement("carouselNext").dispatch("click");
  assert.equal(activeImage(firstVisit), "assets/text-v2.png");
  const nextVisit = runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
  assert.equal(activeImage(nextVisit), "assets/home-v2.png");
  assert.equal(new Script('shotPanels[0].dataset.shotSlot').runInContext(nextVisit.context), "active");
  assert.equal(new Script('shotDots[0].getAttribute("aria-current")').runInContext(nextVisit.context), "true");
  assert.match(site, /data-shot-index="0"[^>]*data-i18n-aria-label="show_shot_home"/);
  const homeImage = site.match(/<img src="assets\/home-v2\.png"[^>]*>/)?.[0];
  assert.ok(homeImage);
  assert.doesNotMatch(homeImage, /loading="lazy"/);
});

function runSite(userAgent, blockedStorage = false, maxTouchPoints = 0) {
  let activeElement;
  const element = (id = "") => {
    const listeners = new Map();
    const attributes = new Map();
    return {
      id, hidden: false, open: false, dataset: {}, textContent: "", href: "", scrollHeight: 360,
      style: { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
      },
      dispatch(type, init = {}) {
        const event = {
          button: 0, target: this, currentTarget: this, defaultPrevented: false, ...init,
          preventDefault() { this.defaultPrevented = true; },
          stopPropagation() {},
        };
        for (const callback of listeners.get(type) ?? []) callback(event);
        return event;
      },
      getAttribute(name) { return attributes.get(name) ?? null; },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      removeAttribute(name) { attributes.delete(name); },
      toggleAttribute(name, force) {
        if (force) attributes.set(name, "");
        else attributes.delete(name);
      },
      querySelector() { return element(); },
      querySelectorAll() { return []; },
      closest() { return element(); },
      contains(target) { return target === this; },
      getBoundingClientRect() { return { left: 320, right: 520, top: 200, bottom: 260, width: 200, height: 60 }; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      focus() { activeElement = this; },
    };
  };
  const downloadButton = element("downloadBtn");
  const downloadLabel = { textContent: "", getAttribute: () => "download_button" };
  downloadButton.querySelector = () => downloadLabel;
  const elements = new Map([["downloadBtn", downloadButton]]);
  const cards = [...site.matchAll(/<a class="shotCard"[^>]*data-img="([^"]+)"/g)].map((match) => {
    const card = element();
    card.setAttribute("data-img", match[1]);
    return card;
  });
  const galleryElements = new Map([
    [".shotCard", cards],
    [".shotPanel", cards.map(() => element())],
    [".carouselDot", cards.map(() => element())],
  ]);
  let onReady;
  const document = {
    documentElement: { clientWidth: 1024, style: { setProperty() {} }, setAttribute() {} },
    get activeElement() { return activeElement; },
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    },
    querySelector: (selector) => selector === "#downloadBtn [data-i18n]" ? downloadLabel : element(),
    querySelectorAll: (selector) => selector === "[data-i18n]" ? [downloadLabel] : galleryElements.get(selector) ?? [],
    addEventListener: (event, callback) => { if (event === "DOMContentLoaded") onReady = callback; },
  };
  const localStorage = {
    getItem() { if (blockedStorage) throw new Error("storage blocked"); return null; },
    setItem() { if (blockedStorage) throw new Error("storage blocked"); },
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    location: { search: "" },
    innerWidth: 1024,
    innerHeight: 768,
    visualViewport: { width: 1024, height: 768, addEventListener() {} },
    addEventListener() {},
    requestAnimationFrame(callback) { callback(); },
  };
  const context = createContext({
    document, window, localStorage, URLSearchParams,
    navigator: { userAgent, platform: "", language: "en-US", maxTouchPoints },
  });
  new Script(siteScript).runInContext(context);
  onReady?.();
  return {
    context,
    downloadButton,
    downloadLabel,
    getElement: id => document.getElementById(id),
    getActiveElement: () => activeElement,
  };
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

test("download popover geometry stays anchored and clamped to the viewport", () => {
  const { context } = runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
  const cases = [
    {
      anchor: { left: 500, right: 700, top: 120, bottom: 180, width: 200, height: 60 },
      viewport: { width: 1200, height: 800 },
      panel: { width: 400, height: 360 },
      opensBelow: true,
    },
    {
      anchor: { left: 0, right: 96, top: 80, bottom: 128, width: 96, height: 48 },
      viewport: { width: 390, height: 700 },
      panel: { width: 340, height: 420 },
    },
    {
      anchor: { left: 310, right: 390, top: 430, bottom: 478, width: 80, height: 48 },
      viewport: { width: 390, height: 520 },
      panel: { width: 340, height: 900 },
    },
  ];

  for (const { anchor, viewport, panel, opensBelow } of cases) {
    const expression = `getDownloadPopoverPosition(${JSON.stringify(anchor)}, ${JSON.stringify(viewport)}, ${JSON.stringify(panel)})`;
    const position = evaluateJson(context, expression);
    assert.deepEqual(Object.keys(position).sort(), ["anchorX", "left", "maxHeight", "top"]);
    for (const [key, value] of Object.entries(position)) assert.ok(Number.isFinite(value), `${key} must be finite`);
    assert.ok(position.left >= 0, "popover escapes the left viewport edge");
    assert.ok(position.left + panel.width <= viewport.width, "popover escapes the right viewport edge");
    assert.ok(position.top >= 0, "popover escapes the top viewport edge");
    assert.ok(position.maxHeight > 0 && position.maxHeight <= viewport.height, "invalid popover max height");
    assert.ok(position.top + Math.min(panel.height, position.maxHeight) <= viewport.height, "popover escapes the bottom viewport edge");
    assert.ok(position.anchorX >= 0 && position.anchorX <= panel.width, "anchor indicator escapes the panel");
    if (opensBelow) assert.ok(position.top >= anchor.bottom, "roomy popover should open beneath its trigger");
    assert.deepEqual(evaluateJson(context, expression), position, "geometry helper must be deterministic");
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

test("Mac chooser can transition to the existing all-downloads dialog", () => {
  const { context, downloadButton, getElement, getActiveElement } = runSite("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
  const macDialog = getElement("macDownloadDialog");
  const allDownloadsDialog = getElement("allDownloadsDialog");
  const macAllDownloads = getElement("macAllDownloads");

  assert.ok(downloadButton.dispatch("click").defaultPrevented);
  assert.equal(macDialog.open, true);
  assert.equal(macAllDownloads.dispatch("click", { metaKey: true }).defaultPrevented, false);
  assert.equal(macDialog.open, true);
  assert.equal(allDownloadsDialog.open, false);
  assert.ok(macAllDownloads.dispatch("click").defaultPrevented);
  assert.equal(macDialog.open, false);
  assert.equal(allDownloadsDialog.open, true);
  new Script("closeDownloadDialog(allDownloadsDialog)").runInContext(context);
  assert.equal(allDownloadsDialog.open, false);
  assert.equal(getActiveElement(), downloadButton);
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

test("contact links are labeled plainly and Help has no stray arrows", () => {
  const contacts = [...site.matchAll(/<a href="mailto:penguin\.pdf\.tools@gmail\.com" data-i18n="footer_contact">Contact us<\/a>/g)];
  assert.equal(contacts.length, 2);
  assert.doesNotMatch(site, /help_contact_prefix|arrow_right/);
  assert.equal(site.match(/\bfooter_contact:/g)?.length, 2);
});

test("English and Spanish include the gallery and download labels without a version badge", () => {
  assert.doesNotMatch(site, /class="versionLabel"|\.versionLabel\{|\bversion_label:/);
  assert.match(site, /<meta name="description" content="PenguinPDF 2\.0\.0:/);
  for (const key of [
    "download_button", "download_windows", "download_mac", "mac_apple", "mac_intel", "win_exe", "win_msi",
    "mac_dialog_intro", "mac_apple_detail", "mac_intel_detail", "mac_other_downloads",
    "screenshots_label", "previous_screenshot", "next_screenshot",
    "slide_1_of_4", "slide_2_of_4", "slide_3_of_4", "slide_4_of_4",
    "shot_text", "shot_fill", "shot_edit", "shot_home",
    "alt_text", "alt_fill", "alt_edit", "alt_home",
  ]) {
    assert.equal(site.match(new RegExp(`\\b${key}:`, "g"))?.length, 2, key);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  analyticsMode,
  buildCountURL,
  hasPrivacyOptOut,
  installerEventForURL,
  isPublishedHomepage,
  sanitizeAttribution,
  sanitizeReferrer,
  setupWebsiteAnalytics,
} from "../docs/analytics.mjs";

const site = "https://grojobil.github.io/PenguinPDF/";
const release = "https://github.com/grojobil/PenguinPDF/releases/download/v2.0.0/";
const siteHTML = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const privacyHTML = readFileSync(new URL("../docs/privacy.html", import.meta.url), "utf8");
const installers = [
  ["PenguinPDF-2.0.0-macOS-Apple-Silicon.dmg", "download-macos-apple-silicon", "Apple Silicon installer link clicked"],
  ["PenguinPDF-2.0.0-macOS-Intel.dmg", "download-macos-intel", "Intel Mac installer link clicked"],
  ["PenguinPDF_x64-setup.exe", "download-windows-exe", "Windows EXE installer link clicked"],
  ["PenguinPDF_x64_en-US.msi", "download-windows-msi", "Windows MSI installer link clicked"],
];

function harness({ href = site, visibilityState = "visible", referrer = "", storage = null, fetcher } = {}) {
  const listeners = new Map();
  const calls = [];
  const document = {
    visibilityState,
    referrer,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    removeEventListener(type, callback) {
      listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== callback));
    },
    dispatch(type, event = {}) {
      const value = { type, button: 0, defaultPrevented: false, ...event };
      for (const callback of [...(listeners.get(type) ?? [])]) callback(value);
      return value;
    },
  };
  const window = {
    location: new URL(href),
    navigator: {},
    localStorage: storage ?? { getItem: () => null },
    fetch: fetcher ?? ((...args) => { calls.push(args); return Promise.resolve(); }),
  };
  window.top = window;
  return { calls, document, window };
}

function anchor(href, attributes = {}) {
  return {
    closest(selector) { return selector === "a[href]" ? this : null; },
    getAttribute(name) { return name === "href" ? href : attributes[name] ?? null; },
    hasAttribute(name) { return Object.hasOwn(attributes, name); },
  };
}

function payloads(calls) {
  return calls.map(([request]) => Object.fromEntries(new URL(request).searchParams));
}

test("pure helpers bound the homepage, attribution, referrer, and GoatCounter payload", () => {
  for (const path of ["/PenguinPDF/", "/PenguinPDF", "/PenguinPDF/index.html"]) {
    assert.equal(isPublishedHomepage(`https://grojobil.github.io${path}?anything=1#fragment`), true);
  }
  for (const url of ["http://grojobil.github.io/PenguinPDF/", "https://grojobil.github.io/", "https://example.com/PenguinPDF/"]) {
    assert.equal(isPublishedHomepage(url), false);
  }
  assert.equal(analyticsMode("?analytics=qa"), "qa");
  assert.equal(analyticsMode("?analytics=qa&analytics=off"), "off");
  assert.equal(sanitizeAttribution("?utm_campaign=Launch_2&utm_source=Reddit&token=SECRET&email=a%40b.test#private"), "?utm_source=reddit&utm_campaign=Launch_2");
  assert.equal(sanitizeAttribution(`?utm_source=${"a".repeat(81)}&utm_campaign=bad.value&utm_source=duplicate`), "");
  assert.equal(sanitizeReferrer("https://user:secret@example.com/private?q=token#hash"), "https://example.com");
  assert.equal(sanitizeReferrer("https://grojobil.github.io/private?q=secret"), "");
  assert.equal(sanitizeReferrer("data:text/plain,secret"), "");

  const request = new URL(buildCountURL({
    path: "/PenguinPDF/", title: "PenguinPDF", referrer: "https://example.com",
    query: "?utm_source=reddit", rnd: "fixed",
  }));
  assert.equal(request.origin + request.pathname, "https://penguinpdf.goatcounter.com/count");
  assert.deepEqual([...request.searchParams.keys()], ["p", "t", "r", "q", "rnd"]);
  assert.deepEqual(Object.fromEntries(request.searchParams), {
    p: "/PenguinPDF/", t: "PenguinPDF", r: "https://example.com",
    q: "?utm_source=reddit", rnd: "fixed",
  });
  assert.doesNotMatch(request.href, /SECRET|token|email|private|no_session/);
});

test("website loads the local sidecar once after handlers and links bilingual privacy disclosure", () => {
  const analyticsScripts = [...siteHTML.matchAll(/<script\b[^>]*\bsrc="analytics\.mjs[^\"]*"[^>]*><\/script>/g)];
  assert.equal(analyticsScripts.length, 1);
  assert.ok(analyticsScripts[0].index > siteHTML.indexOf("loadDownloadStats();"));
  assert.match(siteHTML, /<a\b[^>]*\bid="privacyLink"[^>]*\bhref="privacy\.html"[^>]*\bdata-i18n="footer_privacy"/);
  assert.match(siteHTML, /footer_privacy: "Privacy"/);
  assert.match(siteHTML, /footer_privacy: "Privacidad"/);
  assert.match(privacyHTML, /id="privacy-en"[\s\S]*?GoatCounter[\s\S]*?analytics=off/);
  assert.match(privacyHTML, /id="privacy-es"[\s\S]*?GoatCounter[\s\S]*?analytics=off/);
  assert.doesNotMatch(siteHTML, /<script\b[^>]*\bsrc="https:\/\/gc\.zgo\.at\/count\.js/);
  assert.doesNotMatch(siteHTML, /<script\b[^>]*\bsrc="https:\/\/penguinpdf\.goatcounter\.com\/count\.js/);
});

test("privacy opt-outs and blocked storage fail closed without throwing", () => {
  for (const value of ["1", "yes", "YES"]) {
    const { window } = harness();
    window.navigator.doNotTrack = value;
    assert.equal(hasPrivacyOptOut(window), true);
  }
  for (const flag of ["globalPrivacyControl", "webdriver"]) {
    const { window } = harness();
    window.navigator[flag] = true;
    assert.equal(hasPrivacyOptOut(window), true);
  }
  assert.equal(hasPrivacyOptOut(harness({ storage: { getItem: () => "t" } }).window), true);
  assert.equal(hasPrivacyOptOut(harness({ storage: { getItem() { throw new Error("blocked"); } } }).window), true);
  assert.equal(hasPrivacyOptOut(harness().window), false);
});

test("only the four exact release assets are recognized", () => {
  for (const [filename, event, title] of installers) {
    assert.deepEqual(installerEventForURL(`${release}${filename}?utm_source=secret#fragment`), { event, title });
  }
  for (const href of [
    "https://github.com/grojobil/PenguinPDF/releases/tag/v2.0.0",
    `${release}PenguinPDF-arm64.dmg`,
    `${release}PenguinPDF_x64-setup.exe/extra`,
    "https://github.com/grojobil/Other/releases/download/v2.0.0/PenguinPDF_x64-setup.exe",
    "https://user:secret@github.com/grojobil/PenguinPDF/releases/download/v2.0.0/PenguinPDF_x64-setup.exe",
    "http://github.com/grojobil/PenguinPDF/releases/download/v2.0.0/PenguinPDF_x64-setup.exe",
  ]) assert.equal(installerEventForURL(href), null, href);
});

test("a visible page and every exact installer produce bounded attributed requests", () => {
  for (const [filename, specificEvent, specificTitle] of installers) {
    const env = harness({
      href: `${site}?utm_source=NEWSLETTER&utm_campaign=Fall_2026&secret=never`,
      referrer: "https://search.example/private?q=pdf",
    });
    assert.equal(setupWebsiteAnalytics(env.window, env.document), true);
    env.document.dispatch("click", { target: anchor(`${release}${filename}?auth=never#secret`) });
    const sent = payloads(env.calls);
    assert.equal(sent.length, 3);
    assert.deepEqual(sent.map(item => item.p), ["/PenguinPDF/", "download-installer", specificEvent]);
    assert.deepEqual(sent.map(item => item.t), ["PenguinPDF", "Installer link clicked", specificTitle]);
    assert.deepEqual(sent.map(item => item.q), Array(3).fill("?utm_source=newsletter&utm_campaign=Fall_2026"));
    assert.deepEqual(sent.map(item => item.r), Array(3).fill("https://search.example"));
    assert.equal(sent[0].e, undefined);
    assert.equal(sent[1].e, "true");
    assert.equal(sent[2].e, "true");
    assert.ok(sent.every(item => !Object.hasOwn(item, "no_session")));
    assert.doesNotMatch(env.calls.map(([url]) => url).join(""), /secret|auth|never/i);
  }
});

test("delegation excludes choosers, canceled, right, and disabled clicks but accepts keyboard and middle clicks", () => {
  const env = harness({ visibilityState: "hidden" });
  setupWebsiteAnalytics(env.window, env.document);
  const installer = anchor(`${release}${installers[0][0]}`);
  env.document.dispatch("click", { target: anchor("https://github.com/grojobil/PenguinPDF/releases/tag/v2.0.0") });
  env.document.dispatch("click", { target: installer, defaultPrevented: true });
  env.document.dispatch("click", { target: installer, button: 2 });
  env.document.dispatch("click", { target: installer, button: 1 });
  env.document.dispatch("auxclick", { target: installer, button: 2 });
  env.document.dispatch("click", { target: anchor(installer.getAttribute("href"), { disabled: "" }) });
  env.document.dispatch("click", { target: anchor(installer.getAttribute("href"), { "aria-disabled": "true" }) });
  assert.equal(env.calls.length, 0);

  const keyboard = env.document.dispatch("click", { target: installer, button: 0, detail: 0 });
  const middle = env.document.dispatch("auxclick", { target: installer, button: 1 });
  assert.equal(env.calls.length, 4);
  assert.equal(keyboard.defaultPrevented, false);
  assert.equal(middle.defaultPrevented, false);
});

test("page visibility is delayed, prerender is silent, and setup cannot bind twice", () => {
  for (const initial of ["hidden", "prerender"]) {
    const env = harness({ visibilityState: initial });
    assert.equal(setupWebsiteAnalytics(env.window, env.document), true);
    assert.equal(setupWebsiteAnalytics(env.window, env.document), false);
    assert.equal(env.calls.length, 0);
    env.document.dispatch("visibilitychange");
    assert.equal(env.calls.length, 0);
    env.document.visibilityState = "visible";
    env.document.dispatch("visibilitychange");
    env.document.dispatch("visibilitychange");
    assert.equal(env.calls.length, 1);
  }
});

test("local, offsite, framed, and live privacy states do not collect", () => {
  for (const href of ["http://localhost:8000/PenguinPDF/", "https://example.com/PenguinPDF/"]) {
    const env = harness({ href });
    assert.equal(setupWebsiteAnalytics(env.window, env.document), false);
    assert.equal(env.calls.length, 0);
  }
  const framed = harness();
  framed.window.top = {};
  assert.equal(setupWebsiteAnalytics(framed.window, framed.document), false);

  for (const configure of [
    env => { env.window.navigator.doNotTrack = "1"; },
    env => { env.window.navigator.globalPrivacyControl = true; },
    env => { env.window.navigator.webdriver = true; },
    env => { env.window.localStorage = { getItem: () => "t" }; },
    env => { env.window.localStorage = { getItem() { throw new Error("blocked"); } }; },
  ]) {
    const env = harness();
    configure(env);
    setupWebsiteAnalytics(env.window, env.document);
    env.document.dispatch("click", { target: anchor(`${release}${installers[0][0]}`) });
    assert.equal(env.calls.length, 0);
  }

  const live = harness();
  setupWebsiteAnalytics(live.window, live.document);
  live.calls.length = 0;
  live.window.navigator.globalPrivacyControl = true;
  live.document.dispatch("click", { target: anchor(`${release}${installers[0][0]}`) });
  assert.equal(live.calls.length, 0);

  const off = harness({ href: `${site}?analytics=off` });
  setupWebsiteAnalytics(off.window, off.document);
  off.document.dispatch("click", { target: anchor(`${release}${installers[0][0]}`) });
  assert.equal(off.calls.length, 0);
});

test("fetch failures are swallowed and requests use the nonblocking privacy options", async () => {
  for (const fetcher of [
    () => { throw new Error("sync failure"); },
    () => Promise.reject(new Error("offline")),
    () => Promise.resolve({ ok: false }),
  ]) {
    let calls = 0;
    const options = [];
    const env = harness({
      visibilityState: "hidden",
      fetcher(url, init) { calls++; options.push(init); return fetcher(url, init); },
    });
    setupWebsiteAnalytics(env.window, env.document);
    const event = assert.doesNotThrow(() => env.document.dispatch("click", {
      target: anchor(`${release}${installers[2][0]}`),
    }));
    assert.equal(calls, 2);
    assert.equal(event, undefined);
    for (const option of options) assert.deepEqual(option, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    await new Promise(resolve => setImmediate(resolve));
  }
});

test("QA traffic is event-only and isolated from organic names", () => {
  const env = harness({ href: `${site}?analytics=qa&utm_source=Manual_QA` });
  setupWebsiteAnalytics(env.window, env.document);
  env.document.dispatch("click", { target: anchor(`${release}${installers[3][0]}`) });
  const sent = payloads(env.calls);
  assert.deepEqual(sent.map(item => item.p), ["qa-page-view", "qa-download-installer", "qa-download-windows-msi"]);
  assert.deepEqual(sent.map(item => item.e), ["true", "true", "true"]);
  assert.deepEqual(sent.map(item => item.q), Array(3).fill("?utm_source=manual_qa"));
  assert.ok(sent.every(item => item.p.startsWith("qa-")));
});

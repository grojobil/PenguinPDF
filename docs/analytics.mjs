const COUNT_ENDPOINT = "https://penguinpdf.goatcounter.com/count";
const SITE_ORIGIN = "https://grojobil.github.io";
const HOMEPAGE_PATH = "/PenguinPDF/";
const INSTALLER_PREFIX = "/grojobil/PenguinPDF/releases/download/v2.0.0/";
const ATTRIBUTION_VALUE = /^[a-zA-Z0-9_-]{1,80}$/;

const INSTALLERS = Object.freeze({
  "PenguinPDF-2.0.0-macOS-Apple-Silicon.dmg": Object.freeze({
    event: "download-macos-apple-silicon",
    title: "Apple Silicon installer link clicked",
  }),
  "PenguinPDF-2.0.0-macOS-Intel.dmg": Object.freeze({
    event: "download-macos-intel",
    title: "Intel Mac installer link clicked",
  }),
  "PenguinPDF_x64-setup.exe": Object.freeze({
    event: "download-windows-exe",
    title: "Windows EXE installer link clicked",
  }),
  "PenguinPDF_x64_en-US.msi": Object.freeze({
    event: "download-windows-msi",
    title: "Windows MSI installer link clicked",
  }),
});

const setupDocuments = new WeakSet();

function asURL(location) {
  try {
    if (location instanceof URL) return location;
    if (typeof location === "string") return new URL(location);
    if (typeof location?.href === "string") return new URL(location.href);
    return new URL(`${location?.origin ?? ""}${location?.pathname ?? ""}${location?.search ?? ""}`);
  } catch {
    return null;
  }
}

export function isPublishedHomepage(location) {
  const url = asURL(location);
  return url?.origin === SITE_ORIGIN &&
    [HOMEPAGE_PATH, "/PenguinPDF", "/PenguinPDF/index.html"].includes(url.pathname);
}

export function analyticsMode(search = "") {
  const params = new URLSearchParams(search);
  const values = params.getAll("analytics");
  if (values.includes("off")) return "off";
  return values.includes("qa") ? "qa" : "standard";
}

export function sanitizeAttribution(search = "") {
  const source = new URLSearchParams(search);
  const clean = new URLSearchParams();
  for (const key of ["utm_source", "utm_campaign"]) {
    const values = source.getAll(key);
    if (values.length !== 1 || !ATTRIBUTION_VALUE.test(values[0])) continue;
    clean.set(key, key === "utm_source" ? values[0].toLowerCase() : values[0]);
  }
  const query = clean.toString();
  return query ? `?${query}` : "";
}

export function sanitizeReferrer(referrer, pageOrigin = SITE_ORIGIN) {
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === pageOrigin) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function installerEventForURL(href, base = `${SITE_ORIGIN}${HOMEPAGE_PATH}`) {
  try {
    const url = new URL(href, base);
    if (url.origin !== "https://github.com" || url.username || url.password ||
        !url.pathname.startsWith(INSTALLER_PREFIX)) return null;
    const filename = url.pathname.slice(INSTALLER_PREFIX.length);
    return Object.hasOwn(INSTALLERS, filename) ? INSTALLERS[filename] : null;
  } catch {
    return null;
  }
}

export function buildCountURL({ path, title, referrer = "", query = "", event = false, width, bot, rnd }) {
  const url = new URL(COUNT_ENDPOINT);
  url.searchParams.set("p", path);
  url.searchParams.set("t", title);
  url.searchParams.set("r", referrer);
  url.searchParams.set("q", query);
  if (event) url.searchParams.set("e", "true");
  if (Number.isSafeInteger(width) && width > 0) url.searchParams.set("s", String(width));
  if (typeof bot === "string" && bot) url.searchParams.set("b", bot);
  url.searchParams.set("rnd", String(rnd));
  return url.href;
}

export function hasPrivacyOptOut(windowObject) {
  const navigator = windowObject.navigator ?? {};
  const doNotTrack = String(navigator.doNotTrack ?? "").toLowerCase();
  if (doNotTrack === "1" || doNotTrack === "yes" ||
      navigator.globalPrivacyControl === true || navigator.webdriver === true) return true;
  try {
    return windowObject.localStorage?.getItem("skipgc") === "t";
  } catch {
    return true;
  }
}

function isTopLevel(windowObject) {
  try {
    return windowObject.top === windowObject;
  } catch {
    return false;
  }
}

function isDisabledAnchor(anchor) {
  return anchor.hasAttribute?.("disabled") ||
    String(anchor.getAttribute?.("aria-disabled") ?? "").toLowerCase() === "true";
}

export function setupWebsiteAnalytics(windowObject, documentObject) {
  if (!windowObject || !documentObject || setupDocuments.has(documentObject) ||
      !isTopLevel(windowObject) || !isPublishedHomepage(windowObject.location)) return false;
  setupDocuments.add(documentObject);

  const initialURL = asURL(windowObject.location);
  const mode = analyticsMode(initialURL.search);
  const query = sanitizeAttribution(initialURL.search);
  const referrer = sanitizeReferrer(documentObject.referrer, initialURL.origin);
  const seenInteractions = new WeakSet();
  let sequence = 0;

  const canCollect = () => isTopLevel(windowObject) &&
    isPublishedHomepage(windowObject.location) &&
    analyticsMode(asURL(windowObject.location)?.search ?? "") !== "off" &&
    !hasPrivacyOptOut(windowObject);

  const post = (path, title, event = false) => {
    if (mode === "off" || !canCollect()) return false;
    const requestURL = buildCountURL({
      path: mode === "qa" && event ? `qa-${path}` : path,
      title,
      referrer,
      query,
      event,
      rnd: `${Date.now().toString(36)}${(++sequence).toString(36)}`,
    });
    try {
      const request = windowObject.fetch(requestURL, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      });
      Promise.resolve(request).catch(() => {});
    } catch {}
    return true;
  };

  let pageAttempted = false;
  const recordVisiblePage = () => {
    if (pageAttempted || (documentObject.visibilityState && documentObject.visibilityState !== "visible")) return;
    pageAttempted = post(mode === "qa" ? "page-view" : HOMEPAGE_PATH, "PenguinPDF", mode === "qa");
    if (pageAttempted) documentObject.removeEventListener?.("visibilitychange", recordVisiblePage);
  };
  if (documentObject.visibilityState === "hidden" || documentObject.visibilityState === "prerender") {
    documentObject.addEventListener("visibilitychange", recordVisiblePage);
  } else {
    recordVisiblePage();
  }

  const recordInstaller = event => {
    if (event.defaultPrevented || seenInteractions.has(event)) return;
    if ((event.type === "click" && event.button !== 0) ||
        (event.type === "auxclick" && event.button !== 1)) return;
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor || isDisabledAnchor(anchor)) return;
    const installer = installerEventForURL(anchor.getAttribute("href"), initialURL.href);
    if (!installer || !canCollect()) return;
    seenInteractions.add(event);
    post("download-installer", "Installer link clicked", true);
    post(installer.event, installer.title, true);
  };

  documentObject.addEventListener("click", recordInstaller);
  documentObject.addEventListener("auxclick", recordInstaller);
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  setupWebsiteAnalytics(window, document);
}

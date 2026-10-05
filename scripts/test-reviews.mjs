import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fetchReviews, isValidReviews, renderAllReviews, renderReviews, reviewDateLabel, reviewPage, reviewRange, reviewView, setupReviewDialog } from "../docs/reviews.mjs";

const publicSnapshot = JSON.parse(readFileSync(new URL("../docs/reviews-v2.json", import.meta.url)));
const empty = { schemaVersion: 1, updatedAt: "2026-09-29T12:00:00Z", ratingCount: 0, ratingSum: 0, featured: [] };
const site = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const module = readFileSync(new URL("../docs/reviews.mjs", import.meta.url), "utf8");
const fixture = () => ({
  schemaVersion: 1,
  updatedAt: "2026-09-29T12:00:00Z",
  ratingCount: 3,
  ratingSum: 10,
  featured: [{ id: "1234567890abcdef", rating: 5, comment: "QA example, not a customer review", displayName: "QA example" }],
});

function fakeDocument() {
  const elements = new Map();
  let doc;
  function element(tag = "div") {
    const attributes = {};
    const listeners = new Map();
    return {
      tagName: tag,
      textContent: "",
      className: "",
      hidden: false,
      children: [],
      open: false,
      disabled: false,
      scrollTop: 0,
      style: { setProperty(name, value) { attributes[name] = String(value); } },
      setAttribute(name, value) { attributes[name] = value; },
      getAttribute(name) { return attributes[name]; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, callback) { listeners.set(name, callback); },
      dispatch(name, event = {}) { listeners.get(name)?.({ target: this, ...event }); },
      focus() { doc.activeElement = this; },
      showModal() { this.open = true; },
      close() { this.open = false; this.dispatch("close"); },
      getBoundingClientRect() { return { left: 100, top: 100, right: 700, bottom: 600 }; },
      set innerHTML(_) { throw new Error("Review content must not use innerHTML"); },
    };
  }
  doc = {
    documentElement: { lang: "en" },
    activeElement: null,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: element,
    createElementNS: (_, tag) => element(tag),
  };
  return doc;
}

test("review section follows screenshots and precedes release/mobile links", () => {
  assert.ok(site.indexOf('id="reviews"') > site.indexOf('id="carouselStatus"'));
  assert.ok(site.indexOf('id="reviews"') < site.indexOf('class="secondaryLinks"'));
  assert.match(site, /id="reviewLink"[^>]*href="https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdDG363hP184VcRrEbm67f1sHMdC1gQ4e8KNolZITTuYUiQAA\/viewform\?usp=header"/);
  const moduleHash = createHash("sha256").update(module).digest("hex").slice(0, 12);
  assert.ok(site.includes(`<script type="module" src="reviews.mjs?v=${moduleHash}"></script>`),
    "The review script URL must change with its contents to avoid stale browser caches");
  const validatorHash = createHash("sha256").update(readFileSync(new URL("../docs/review-data.mjs", import.meta.url))).digest("hex").slice(0, 12);
  assert.ok(module.includes(`./review-data.mjs?v=${validatorHash}`), "The imported validator must also bypass stale module caches");
  assert.match(site, /\.reviewCard\{[^}]*border-radius:8px/);
  assert.match(site, /\.reviewGrid\{ --review-columns:1;/);
  assert.match(site, /scroll-snap-type:x mandatory/);
  assert.match(site, /id="reviewsNext"/);
  assert.ok(site.indexOf('id="reviewSummary"') < site.indexOf('id="reviewGrid"'));
  assert.ok(site.indexOf('id="reviewLink"') > site.indexOf('id="reviewNavigation"'));
  assert.doesNotMatch(site, /id="reviewPolicy"|class="reviewMeta"/);
});

test("public snapshot is valid and the empty state invents no ratings or testimonials", () => {
  assert.ok(isValidReviews(publicSnapshot));
  assert.ok(isValidReviews(empty));
  assert.equal(empty.ratingCount, 0);
  assert.equal(empty.ratingSum, 0);
  assert.deepEqual(empty.featured, []);
  const doc = fakeDocument();
  renderReviews(doc, empty, "en");
  assert.ok(doc.getElementById("reviewSummary").hidden);
  assert.ok(doc.getElementById("reviewGrid").hidden);
  assert.ok(doc.getElementById("reviewCaption").hidden);
  assert.equal(doc.getElementById("reviewsTitle").textContent, "Simple. Powerful. Actually useful.");
  assert.equal(doc.getElementById("reviewsTag").textContent, "What people are saying");
});

test("Unicode length matches the importer and featured stars agree with the aggregate", () => {
  const data = fixture();
  data.featured[0].comment = "😀".repeat(600);
  assert.ok(isValidReviews(data));
  data.featured[0].comment += "😀";
  assert.equal(isValidReviews(data), false);
  data.featured[0].comment = "QA example";
  data.ratingCount = 1;
  data.ratingSum = 1;
  assert.equal(isValidReviews(data), false);
});

test("average includes low and unfeatured ratings, not only the 5-star quote", () => {
  const view = reviewView(fixture(), "en");
  assert.equal(view.average, "3.3 / 5");
  assert.equal(view.count, "from 3 ratings");
  assert.match(view.policy, /Selected five-star reviews/);
  assert.match(view.policy, /all valid submitted ratings/);
});

test("minimal review layout keeps selection and rating context without a visible policy paragraph", () => {
  const doc = fakeDocument();
  renderReviews(doc, fixture(), "en");
  assert.equal(doc.getElementById("reviewCaption").textContent, "Featured reviews");
  assert.equal(doc.getElementById("reviewCaption").hidden, false);
  assert.match(doc.getElementById("reviewSummary").getAttribute("title"), /all valid submitted ratings/);
  assert.match(doc.getElementById("reviewGrid").getAttribute("aria-description"), /Selected five-star reviews/);
  assert.match(doc.getElementById("reviewLink").getAttribute("title"), /Google Forms/);
  renderReviews(doc, fixture(), "es");
  assert.equal(doc.getElementById("reviewCaption").textContent, "Reseñas destacadas");
  assert.match(doc.getElementById("reviewSummary").getAttribute("title"), /todas las valoraciones/);
});

test("up to ten selected comments do not limit the aggregate or invent a verified-user count", () => {
  const data = fixture();
  data.ratingCount = 100;
  data.ratingSum = 350;
  data.featured = Array.from({length:10}, (_, index) => ({id:index.toString(16).padStart(16,"0"),rating:5,comment:`QA layout ${index}`,displayName:""}));
  assert.ok(isValidReviews(data));
  const view = reviewView(data,"en");
  assert.equal(view.average,"3.5 / 5");
  assert.equal(view.count,"from 100 ratings");
  assert.equal(view.featured.length,10);
  data.featured.push({id:"1000000000000000",rating:5,comment:"QA excess",displayName:""});
  assert.equal(isValidReviews(data),false);
});

test("carousel range follows desktop, mobile, overflow, and the final visible group", () => {
  assert.deepEqual(reviewRange(10,0,960,324.6667), {start:1,end:3,previous:false,next:true,overflow:true});
  assert.deepEqual(reviewRange(10,7*324.6667,960,324.6667), {start:8,end:10,previous:true,next:false,overflow:true});
  assert.deepEqual(reviewRange(2,364,350,364), {start:2,end:2,previous:true,next:false,overflow:true});
  assert.deepEqual(reviewRange(2,0,960,487), {start:1,end:2,previous:false,next:false,overflow:false});
  assert.equal(reviewRange(0,0,0,0).overflow,false);
  assert.match(module,/prefers-reduced-motion/);
});

test("ratings without public comments still display the aggregate", () => {
  const data = fixture();
  data.featured = [];
  const doc = fakeDocument();
  renderReviews(doc, data, "en");
  assert.equal(doc.getElementById("reviewSummary").hidden, false);
  assert.equal(doc.getElementById("reviewGrid").hidden, true);
  assert.equal(doc.getElementById("reviewCaption").hidden, true);
  assert.equal(doc.getElementById("reviewStatus").hidden, false);
});

test("language changes localize headings, counts, stars and optional anonymous name", () => {
  const data = fixture();
  data.featured[0].displayName = "";
  const doc = fakeDocument();
  renderReviews(doc, data, "es");
  assert.equal(doc.getElementById("reviewAverage").textContent, "3,3 / 5");
  assert.equal(doc.getElementById("reviewsTitle").textContent, "Simple. Potente. Útil de verdad.");
  assert.equal(doc.getElementById("reviewsTag").textContent, "Lo que dice la gente");
  const card = doc.getElementById("reviewGrid").children[0];
  assert.equal(card.children[0].getAttribute("aria-label"), "5 de 5 estrellas");
  assert.equal(card.children[2].children[1].textContent, "Usuario de PenguinPDF");
  renderReviews(doc, data, "en");
  assert.equal(doc.getElementById("reviewGrid").children.length, 1);
  assert.match(doc.getElementById("reviewLinkLabel").textContent, /Leave/);
  assert.match(module, /attributeFilter: \["lang"\]/);
});

test("hostile comments and names remain literal text, never HTML", () => {
  const data = fixture();
  data.featured[0].comment = '<img src=x onerror="alert(1)"><script>attack()</script>';
  data.featured[0].displayName = "<svg onload=attack()>";
  const doc = fakeDocument();
  renderReviews(doc, data, "en");
  const card = doc.getElementById("reviewGrid").children[0];
  assert.equal(card.children[1].textContent, data.featured[0].comment);
  assert.equal(card.children[2].children[1].textContent, data.featured[0].displayName);
  assert.doesNotMatch(module, /innerHTML\s*=/);
});

test("reviewer initials use the actual display name and anonymous reviews get a generic icon", () => {
  const data = fixture();
  const doc = fakeDocument();
  data.featured[0].displayName = "QA Example";
  renderReviews(doc, data, "en");
  assert.equal(doc.getElementById("reviewGrid").children[0].children[2].children[0].textContent, "QE");
  data.featured[0].displayName = "";
  renderReviews(doc, data, "en");
  assert.equal(doc.getElementById("reviewGrid").children[0].children[2].children[0].children[0].tagName, "svg");
});

test("invalid snapshots cannot show fabricated aggregate data or broken cards", () => {
  for (const change of [{ ratingSum: 16 }, { ratingCount: -1 }, { ratingCount: 1.5 }, { updatedAt: "bad date" }, { schemaVersion: 2 }, { featured: [{}] }, { ratingCount: 0, ratingSum: 0, featured: fixture().featured }]) {
    assert.equal(isValidReviews({ ...fixture(), ...change }), false);
  }
  const duplicate = fixture();
  duplicate.featured.push({ ...duplicate.featured[0] });
  assert.equal(isValidReviews(duplicate), false);
  const doc = fakeDocument();
  renderReviews(doc, { ...fixture(), ratingSum: 99 }, "en", true);
  assert.ok(doc.getElementById("reviewSummary").hidden);
  assert.match(doc.getElementById("reviewStatus").textContent, /unavailable/);
});

test("one rating has singular wording and 1-star reviews render correctly", () => {
  const data = fixture();
  data.ratingCount = 1;
  data.ratingSum = 1;
  data.featured[0].rating = 1;
  const doc = fakeDocument();
  renderReviews(doc, data, "en");
  assert.equal(doc.getElementById("reviewCount").textContent, "from 1 rating");
  const stars = doc.getElementById("reviewGrid").children[0].children[0].children;
  assert.equal(stars.filter(star => star.getAttribute("class") === "emptyStar").length, 4);
});

test("same-origin review fetch omits credentials and validates failures", async () => {
  let request;
  assert.deepEqual(await fetchReviews(async (...args) => {
    request = args;
    return { ok: true, json: async () => empty };
  }), empty);
  assert.equal(request[0], "reviews-v2.json");
  assert.equal(request[1].credentials, "omit");
  assert.equal(request[1].cache, "no-cache");
  for (const fetcher of [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => { throw new Error("offline"); },
  ]) await assert.rejects(fetchReviews(fetcher));
});

function archiveFixture(total = 36) {
  const reviews = Array.from({ length: total }, (_, index) => ({
    id: index.toString(16).padStart(16, "0"), rating: index === 2 ? 4 : 5,
    comment: `QA public comment ${index}, not customer feedback`, displayName: `QA ${index}`,
  }));
  return { schemaVersion: 2, updatedAt: empty.updatedAt, ratingCount: total + 1,
    ratingSum: reviews.reduce((sum, review) => sum + review.rating, 0) + 1,
    reviews, featured: reviews.filter(review => review.rating === 5).slice(0, 10) };
}

test("the rating count opens the full-review dialog without adding another section action", () => {
  assert.match(site, /<button[^>]*id="reviewCount"[^>]*aria-haspopup="dialog"[^>]*aria-controls="allReviewsDialog"/);
  assert.match(site, /<dialog[^>]*id="allReviewsDialog"[^>]*aria-labelledby="allReviewsTitle"/);
  const doc = fakeDocument();
  renderReviews(doc, archiveFixture(), "en");
  assert.equal(doc.getElementById("reviewCount").disabled, false);
  assert.match(doc.getElementById("reviewCount").getAttribute("aria-label"), /View all reviews/);
  renderReviews(doc, fixture(), "en");
  assert.equal(doc.getElementById("reviewCount").disabled, true, "Legacy featured-only data must not pretend to contain all reviews");
});

test("all public reviews include lower ratings and retain the complete aggregate", () => {
  const data = archiveFixture();
  const doc = fakeDocument();
  renderAllReviews(doc, data, "en");
  assert.equal(doc.getElementById("allReviewsList").children.length, 10);
  assert.equal(doc.getElementById("allReviewsList").children[2].children[0].getAttribute("aria-label"), "4 out of 5 stars");
  assert.match(doc.getElementById("allReviewsSummary").textContent, /from 37 ratings/);
  assert.match(doc.getElementById("allReviewsNotice").textContent, /permission/);
  assert.equal(doc.getElementById("allReviewsRange").textContent, "Reviews 1 to 10 of 36");
  renderAllReviews(doc, data, "es", 3);
  assert.equal(doc.getElementById("allReviewsList").children.length, 6);
  assert.equal(doc.getElementById("allReviewsTitle").textContent, "Todas las reseñas");
  assert.equal(doc.getElementById("allReviewsRange").textContent, "Reseñas 31 a 36 de 36");
  assert.equal(doc.getElementById("allReviewsNext").disabled, true);
});

test("review pagination is bounded and shows every public comment once", () => {
  assert.deepEqual(reviewPage(36, 99), { page: 3, pages: 4, start: 30, end: 36, previous: true, next: false });
  assert.equal(reviewPage(36, -1).page, 0);
  assert.equal(reviewPage(0).end, 0);
  const data = archiveFixture();
  const doc = fakeDocument();
  const comments = [];
  for (let page = 0; page < 4; page++) {
    renderAllReviews(doc, data, "en", page);
    comments.push(...doc.getElementById("allReviewsList").children.map(card => card.children[1].textContent));
  }
  assert.deepEqual(comments, data.reviews.map(review => review.comment));
});

test("private ratings without public comments show an honest empty dialog", () => {
  const data = { ...archiveFixture(0), featured: [], reviews: [] };
  const doc = fakeDocument();
  renderAllReviews(doc, data, "en");
  assert.equal(doc.getElementById("allReviewsList").children.length, 0);
  assert.equal(doc.getElementById("allReviewsEmpty").hidden, false);
  assert.equal(doc.getElementById("allReviewsNavigation").hidden, true);
  assert.match(doc.getElementById("allReviewsSummary").textContent, /from 1 rating/);
});

test("dialog opens, paginates, dismisses, restores focus, and resets on reopen", () => {
  const doc = fakeDocument();
  const data = archiveFixture();
  renderReviews(doc, data, "en");
  const dialog = doc.getElementById("allReviewsDialog");
  const trigger = doc.getElementById("reviewCount");
  const refreshDialog = setupReviewDialog(doc, () => data);
  trigger.focus();
  trigger.dispatch("click");
  assert.equal(dialog.open, true);
  assert.equal(doc.activeElement, doc.getElementById("allReviewsClose"));
  doc.getElementById("allReviewsNext").dispatch("click");
  assert.equal(doc.getElementById("allReviewsRange").textContent, "Reviews 11 to 20 of 36");
  assert.equal(doc.activeElement, doc.getElementById("allReviewsList"));
  doc.documentElement.lang = "es";
  refreshDialog();
  assert.equal(doc.getElementById("allReviewsRange").textContent, "Reseñas 11 a 20 de 36");
  dialog.dispatch("click", { clientX: 200, clientY: 200 });
  assert.equal(dialog.open, true, "Clicking inside the dialog should not close it");
  dialog.dispatch("click", { clientX: 10, clientY: 10 });
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, trigger);
  trigger.dispatch("click");
  assert.equal(doc.getElementById("allReviewsRange").textContent, "Reseñas 1 a 10 de 36");
  doc.getElementById("allReviewsClose").dispatch("click");
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, trigger);
});

test("full-review text is rendered literally and invalid archives never enable the count", () => {
  const data = archiveFixture(1);
  data.reviews[0].comment = '<img src=x onerror="attack()">';
  const doc = fakeDocument();
  renderAllReviews(doc, data, "en");
  assert.equal(doc.getElementById("allReviewsList").children[0].children[1].textContent, data.reviews[0].comment);
  data.reviews.push({ ...data.reviews[0] });
  renderReviews(doc, data, "en", true);
  assert.equal(doc.getElementById("reviewCount").disabled, true);
});

test("real dates appear only in the full list and historical reviews remain undated", () => {
  const data = archiveFixture(2);
  Object.assign(data.reviews[0], { date: "2026-10-05", dateType: "submitted" });
  Object.assign(data.reviews[1], { date: "2026-09-29", dateType: "imported" });
  const doc = fakeDocument();
  renderReviews(doc, data, "en");
  assert.equal(doc.getElementById("reviewGrid").children[0].children[0].className, "reviewStars");
  renderAllReviews(doc, data, "en");
  const cards = doc.getElementById("allReviewsList").children;
  const date = cards[0].children[0].children[1];
  assert.equal(date.tagName, "time");
  assert.equal(date.getAttribute("datetime"), "2026-10-05");
  assert.equal(date.textContent, "Oct 5, 2026");
  assert.equal(cards[1].children[0].className, "reviewStars");
  assert.equal(reviewDateLabel({}, "en"), "");
  assert.equal(reviewDateLabel(data.reviews[1], "es"), "");
  renderAllReviews(doc, data, "es");
  assert.equal(doc.getElementById("allReviewsList").children[1].children[0].className, "reviewStars");
});

test("the carousel starts at the first source-selected reviews without assuming a permanent live count", () => {
  const doc = fakeDocument();
  renderReviews(doc, publicSnapshot, "en");
  assert.deepEqual(doc.getElementById("reviewGrid").children.slice(0, 2).map(card => card.children[1].textContent),
    publicSnapshot.featured.slice(0, 2).map(review => review.comment));
  assert.ok(publicSnapshot.featured.length <= 10);
});

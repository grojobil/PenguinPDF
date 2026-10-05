import { isValidReviews } from "./review-data.mjs?v=f02d8b8ae7f3";
export { isValidReviews } from "./review-data.mjs?v=f02d8b8ae7f3";

const COPY = {
  en: {
    tag: "What people are saying",
    title: "Simple. Powerful. Actually useful.",
    intro: "Feedback from people using PenguinPDF.",
    link: "Leave a review",
    selectedLabel: "Featured reviews",
    invitation: "Tried PenguinPDF? Tell us what you think.",
    unavailable: "Reviews are unavailable right now. You can still leave yours.",
    anonymous: "PenguinPDF user",
    rating: "{rating} out of 5 stars",
    single: "from 1 rating",
    plural: "from {count} ratings",
    private: "Optional feedback via Google Forms. Comments are published only with permission.",
    aggregate: "The average includes all valid submitted ratings, not just featured comments.",
    featured: "Selected feedback, shared with permission. The average includes all valid submitted ratings.",
    fiveStar: "Selected five-star reviews, shared with permission. The average includes all valid submitted ratings.",
    previous: "Previous reviews",
    next: "Next reviews",
    range: "Reviews {start} to {end} of {count}",
    allTitle: "All reviews",
    browse: "View all reviews ({count} ratings)",
    publicNotice: "Comments shared with permission. Newest first.",
    noComments: "No public comments yet.",
    close: "Close reviews",
    importedDate: "Imported {date}",
    submittedDate: "Submitted {date}",
  },
  es: {
    tag: "Lo que dice la gente",
    title: "Simple. Potente. Útil de verdad.",
    intro: "Opiniones de personas que usan PenguinPDF.",
    link: "Dejar una reseña",
    selectedLabel: "Reseñas destacadas",
    invitation: "¿Has probado PenguinPDF? Cuéntanos qué te parece.",
    unavailable: "Las reseñas no están disponibles ahora. Puedes dejar la tuya.",
    anonymous: "Usuario de PenguinPDF",
    rating: "{rating} de 5 estrellas",
    single: "de 1 valoración",
    plural: "de {count} valoraciones",
    private: "Opinión opcional mediante Google Forms. Solo publicamos comentarios con permiso.",
    aggregate: "La media incluye todas las valoraciones válidas enviadas, no solo los comentarios destacados.",
    featured: "Opiniones seleccionadas, publicadas con permiso. La media incluye todas las valoraciones válidas enviadas.",
    fiveStar: "Reseñas seleccionadas de cinco estrellas, publicadas con permiso. La media incluye todas las valoraciones válidas enviadas.",
    previous: "Reseñas anteriores",
    next: "Reseñas siguientes",
    range: "Reseñas {start} a {end} de {count}",
    allTitle: "Todas las reseñas",
    browse: "Ver todas las reseñas ({count} valoraciones)",
    publicNotice: "Comentarios publicados con permiso. Los más recientes primero.",
    noComments: "Todavía no hay comentarios públicos.",
    close: "Cerrar reseñas",
    importedDate: "Importada el {date}",
    submittedDate: "Enviada el {date}",
  },
};

export function reviewView(data, language, failed = false) {
  const lang = language === "es" ? "es" : "en";
  const copy = COPY[lang];
  const valid = isValidReviews(data);
  const count = valid ? data.ratingCount : 0;
  return {
    lang,
    copy,
    title: copy.title,
    average: count ? (data.ratingSum / count).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " / 5" : "",
    count: count === 1 ? copy.single : copy.plural.replace("{count}", count.toLocaleString(lang)),
    status: failed ? copy.unavailable : count ? copy.intro : copy.invitation,
    policy: valid && data.featured.length ? data.featured.every(review => review.rating === 5) ? copy.fiveStar : copy.featured : count ? copy.aggregate : copy.private,
    featured: valid ? data.featured : [],
    all: valid && data.schemaVersion === 2 ? data.reviews : [],
    hasArchive: valid && data.schemaVersion === 2,
    hasRatings: count > 0,
  };
}

function makeStars(doc, rating, label) {
  const stars = doc.createElement("span");
  stars.className = "reviewStars";
  stars.setAttribute("role", "img");
  stars.setAttribute("aria-label", label.replace("{rating}", rating));
  for (let index = 1; index <= 5; index++) {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (index > rating) svg.setAttribute("class", "emptyStar");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    // Lucide star, ISC licensed. Submitted content is never parsed as HTML.
    path.setAttribute("d", "M11.48 2.317a.562.562 0 0 1 1.04 0l2.125 4.305a2 2 0 0 0 1.506 1.095l4.75.694a.562.562 0 0 1 .31.96l-3.436 3.348a2 2 0 0 0-.575 1.77l.81 4.728a.562.562 0 0 1-.815.592l-4.248-2.232a2 2 0 0 0-1.862 0L6.838 19.81a.562.562 0 0 1-.815-.592l.81-4.727a2 2 0 0 0-.575-1.771L2.822 9.373a.562.562 0 0 1 .31-.96l4.749-.693a2 2 0 0 0 1.507-1.095z");
    svg.append(path);
    stars.append(svg);
  }
  return stars;
}

export function renderReviews(doc, data, language, failed = false) {
  const view = reviewView(data, language, failed);
  const element = id => doc.getElementById(id);
  element("reviewsTag").textContent = view.copy.tag;
  element("reviewsTitle").textContent = view.title;
  element("reviewLinkLabel").textContent = view.copy.link;
  element("reviewAverage").textContent = view.average;
  element("reviewCount").textContent = view.count;
  element("reviewCount").disabled = !view.hasArchive;
  element("reviewCount").setAttribute("title", view.hasArchive ? view.copy.allTitle : view.copy.aggregate);
  element("reviewCount").setAttribute("aria-label", view.copy.browse.replace("{count}", view.hasRatings ? data.ratingCount.toLocaleString(view.lang) : "0"));
  element("reviewSummary").hidden = !view.hasRatings;
  element("reviewSummary").setAttribute("title", view.copy.aggregate);
  element("reviewLink").setAttribute("title", view.copy.private);
  element("reviewStatus").textContent = view.status;
  element("reviewStatus").hidden = !view.status;
  element("reviewCaption").textContent = view.copy.selectedLabel;
  element("reviewCaption").hidden = view.featured.length === 0;
  element("reviewGrid").setAttribute("aria-description", view.policy);
  const cards = view.featured.map(review => makeReviewCard(doc, review, view));
  element("reviewGrid").replaceChildren(...cards);
  element("reviewGrid").hidden = cards.length === 0;
  element("reviewGrid").style.setProperty("--review-count", Math.max(1, cards.length));
  element("reviewsPrevious").setAttribute("aria-label", view.copy.previous);
  element("reviewsNext").setAttribute("aria-label", view.copy.next);
}

export function reviewDateLabel(review, language) {
  if (!review.date) return "";
  const locale = language === "es" ? "es" : "en";
  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${review.date}T00:00:00Z`));
  return review.dateType === "imported" ? COPY[locale].importedDate.replace("{date}", date) : date;
}

function makeReviewCard(doc, review, view, showDate = false) {
    const card = doc.createElement("article");
    card.className = "reviewCard";
    const quote = doc.createElement("blockquote");
    quote.textContent = review.comment;
    const author = doc.createElement("div");
    author.className = "reviewAuthor";
    const avatar = doc.createElement("span");
    avatar.className = "reviewAvatar";
    avatar.setAttribute("aria-hidden", "true");
    const words = review.displayName.trim().split(/\s+/u);
    if (review.displayName.trim()) {
      avatar.textContent = ([...words[0]][0] + (words.length > 1 ? [...words.at(-1)][0] : "")).toLocaleUpperCase(view.lang);
    } else {
      const icon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      // Lucide user-round, ISC licensed; no fabricated reviewer photograph.
      path.setAttribute("d", "M20 21a8 8 0 0 0-16 0");
      const circle = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "8");
      circle.setAttribute("r", "5");
      icon.append(path, circle);
      avatar.append(icon);
    }
    const name = doc.createElement("span");
    name.className = "reviewName";
    name.textContent = review.displayName || view.copy.anonymous;
    author.append(avatar, name);
    const stars = makeStars(doc, review.rating, view.copy.rating);
    let header = stars;
    if (showDate && review.date) {
      header = doc.createElement("div");
      header.className = "reviewCardHeader";
      const date = doc.createElement("time");
      date.className = "reviewDate";
      date.setAttribute("datetime", review.date);
      date.textContent = reviewDateLabel(review, view.lang);
      if (review.dateType === "submitted") date.setAttribute("title", view.copy.submittedDate.replace("{date}", date.textContent));
      header.append(stars, date);
    }
    card.append(header, quote, author);
    return card;
}

export function reviewPage(total, requested = 0) {
  const pages = Math.max(1, Math.ceil(total / 10));
  const page = Math.min(pages - 1, Math.max(0, Math.trunc(requested) || 0));
  return { page, pages, start: page * 10, end: Math.min(total, (page + 1) * 10), previous: page > 0, next: page + 1 < pages };
}

export function renderAllReviews(doc, data, language, requested = 0) {
  const view = reviewView(data, language);
  const range = reviewPage(view.all.length, requested);
  const element = id => doc.getElementById(id);
  element("allReviewsTitle").textContent = view.copy.allTitle;
  element("allReviewsSummary").textContent = view.hasRatings ? `${view.average} ${view.count}` : "";
  element("allReviewsNotice").textContent = view.copy.publicNotice;
  element("allReviewsEmpty").textContent = view.copy.noComments;
  element("allReviewsEmpty").hidden = view.all.length > 0;
  element("allReviewsList").replaceChildren(...view.all.slice(range.start, range.end).map(review => makeReviewCard(doc, review, view, true)));
  element("allReviewsList").setAttribute("aria-label", view.copy.allTitle);
  element("allReviewsClose").setAttribute("aria-label", view.copy.close);
  element("allReviewsPrevious").setAttribute("aria-label", view.copy.previous);
  element("allReviewsNext").setAttribute("aria-label", view.copy.next);
  element("allReviewsPrevious").disabled = !range.previous;
  element("allReviewsNext").disabled = !range.next;
  element("allReviewsNavigation").hidden = view.all.length <= 10;
  element("allReviewsRange").textContent = view.all.length ? view.copy.range
    .replace("{start}", (range.start + 1).toLocaleString(view.lang))
    .replace("{end}", range.end.toLocaleString(view.lang))
    .replace("{count}", view.all.length.toLocaleString(view.lang)) : "";
  return range;
}

export function setupReviewDialog(doc, getData) {
  const dialog = doc.getElementById("allReviewsDialog");
  const trigger = doc.getElementById("reviewCount");
  let page = 0;
  let returnFocus;
  const render = () => { page = renderAllReviews(doc, getData(), doc.documentElement.lang, page).page; };
  const move = direction => {
    page += direction;
    render();
    doc.getElementById("allReviewsList").scrollTop = 0;
    doc.getElementById("allReviewsList").focus({ preventScroll: true });
  };
  trigger.addEventListener("click", () => {
    if (trigger.disabled || dialog.open || typeof dialog.showModal !== "function") return;
    returnFocus = doc.activeElement;
    page = 0;
    render();
    dialog.showModal();
    doc.getElementById("allReviewsList").scrollTop = 0;
    doc.getElementById("allReviewsClose").focus();
  });
  doc.getElementById("allReviewsClose").addEventListener("click", () => dialog.close());
  doc.getElementById("allReviewsPrevious").addEventListener("click", () => move(-1));
  doc.getElementById("allReviewsNext").addEventListener("click", () => move(1));
  dialog.addEventListener("close", () => { returnFocus?.focus(); });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  return () => { if (dialog.open) render(); };
}

export function reviewRange(total, scrollLeft, width, step) {
  const visible = Math.max(1, Math.round((width + 14) / Math.max(1, step)));
  const start = Math.min(Math.max(0, total - visible), Math.max(0, Math.round(scrollLeft / Math.max(1, step))));
  return { start: total ? start + 1 : 0, end: Math.min(total, start + visible), previous: start > 0, next: start + visible < total, overflow: total > visible };
}

export async function fetchReviews(fetcher) {
  const response = await fetcher("reviews-v2.json", {
    cache: "no-cache",
    credentials: "omit",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Reviews unavailable");
  const data = await response.json();
  if (!isValidReviews(data)) throw new Error("Invalid reviews snapshot");
  return data;
}

if (typeof document !== "undefined" && document.getElementById("reviews")) {
  let snapshot = null;
  let failed = false;
  const grid = document.getElementById("reviewGrid");
  const previous = document.getElementById("reviewsPrevious");
  const next = document.getElementById("reviewsNext");
  const renderDialog = setupReviewDialog(document, () => snapshot);
  const updateNavigation = () => {
    const view = reviewView(snapshot, document.documentElement.lang, failed);
    const step = (grid.firstElementChild?.getBoundingClientRect().width || grid.clientWidth) + 14;
    const range = reviewRange(view.featured.length, grid.scrollLeft, grid.clientWidth, step);
    document.getElementById("reviewNavigation").hidden = !range.overflow;
    previous.disabled = !range.previous;
    next.disabled = !range.next;
    document.getElementById("reviewCarouselStatus").textContent = range.overflow ? view.copy.range.replace("{start}", range.start).replace("{end}", range.end).replace("{count}", view.featured.length) : "";
  };
  const move = direction => {
    const step = (grid.firstElementChild?.getBoundingClientRect().width || grid.clientWidth) + 14;
    grid.scrollTo({ left: grid.scrollLeft + direction * step, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  grid.addEventListener("scroll", updateNavigation, { passive: true });
  grid.addEventListener("keydown", event => {
    if (event.target === grid && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  new ResizeObserver(updateNavigation).observe(grid);
  const render = () => {
    renderReviews(document, snapshot, document.documentElement.lang, failed);
    renderDialog();
    updateNavigation();
  };
  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  fetchReviews(fetch).then(data => { snapshot = data; }).catch(() => { failed = true; }).finally(render);
}

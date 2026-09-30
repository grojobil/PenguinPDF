# Website Analytics Integration

## Objective And Boundaries

Connect the owner's private `penguinpdf.goatcounter.com` account to the public
website without changing its layout, download routing, installers, or app.
Use GoatCounter's existing server-side session counting; do not invent a
persistent visitor identity. No paid infrastructure, cookies, app telemetry,
document uploads, API secrets, or individual-pageview export collection.

## Current Evidence

- The website currently shows recorded GitHub release-asset downloads only.
- The signed-in GoatCounter account has no data, is private, and has session
  and referrer collection enabled. Session deduplication lasts up to eight hours.
- Existing installer choices are Apple Silicon DMG, Intel DMG, Windows EXE,
  and Windows MSI. Opening a chooser is not an installer click.
- The official GoatCounter browser client sends POST requests to `/count`,
  with `p`, `t`, `r`, `q`, and `e` fields. Its default `q` includes the full
  query string, so this integration will construct a minimal compatible
  request itself rather than forward arbitrary query parameters.
- Unrelated pending review-automation changes must remain uncommitted.

## Implementation

1. Add an isolated browser module with pure payload/routing helpers and Node
   tests. Limit operation to the published origin and homepage paths. Respect
   Do Not Track, Global Privacy Control, and an explicit `analytics=off` URL.
2. Record one visible homepage visit, and installer events only after existing
   handlers have not prevented navigation. Record a deduplicated any-installer
   event plus a format-specific event; these are different views of the same
   activity, not quantities to add together. Do not change navigation or wait
   for telemetry. Catch network/storage failures without breaking downloads.
3. Allow only bounded source/campaign codes in `utm_source`/`utm_campaign`;
   strip other query parameters, fragments, referral paths, and click IDs.
   Use native URL APIs and HTTPS requests without credentials or a Referer.
   Use the sanitized codes as an event referrer label because GoatCounter's
   campaign query parsing applies to page visits only, not click events.
4. Add EN/ES website privacy disclosure and owner documentation explaining
   approximate unique visits, clicks versus completed downloads, future-only
   attribution, ad URL tagging, and exclusion of QA traffic.
5. Exercise controlled live QA under `analytics=qa`, with separate QA event
   names so test activity cannot be mistaken for genuine visitor conversions.
   Preserve the public download counter's meaning; it is unrelated to this
   new website data.
6. Publish only task files after approval, verify the deployed integration and
   the private dashboard, and capture proof. No ad budget, creative, targeting,
   or publication changes are part of this task.

## Acceptance

- Desktop/mobile design, EN/ES switching, carousel, reviews, and installer URLs
  remain intact.
- Popup-only clicks, non-installer links, canceled clicks, right clicks, local
  previews, and privacy opt-outs do not create installer events.
- All four installer links, keyboard activation, and middle-click navigation
  are covered. No event changes hrefs or calls preventDefault.
- Requests contain no arbitrary URL parameters, document data, persistent IDs,
  credentials, or full referral URLs. Failures are nonblocking.
- Tests pass; published HTML/module are verified; controlled QA events are
  visibly present in the authenticated GoatCounter dashboard.

## Roles And Status

Coordinator: routing/privacy decisions, website integration, dashboard review,
evidence, and publication. One Sol/high implementation specialist: isolated
analytics module and focused tests only. No specialist commits or deployment.

- Planning and source inspection: complete.
- Implementation and focused tests: complete with one Sol/high specialist;
  coordinator reviewed the module, payload boundaries, and integration.
- Local regression: 76 Node tests and 10 Python tests passed. Privacy links and
  Spanish disclosure checked at 390px; no horizontal overflow. The committed
  Pages workflow includes the focused analytics tests, without unrelated work.
- Dashboard: private, sessions/referrers/browser/country enabled; individual
  pageview, screen-size, and regional collection disabled. Live QA page and
  installer events received. No installer event came from opening the chooser.
  Final campaign-label validation follows the protocol correction above.
- Publication: explicitly approved by the user; initial deployment succeeded
  at `b1caec8`. Campaign-label correction and its final live check are in progress.

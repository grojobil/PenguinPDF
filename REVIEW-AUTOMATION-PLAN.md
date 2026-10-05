# Automatic Website Reviews

## Objective

Remove per-review exports, approvals, and commits from normal maintenance. All
valid submitted ratings contribute to the average. A bounded carousel shows up
to ten varied, consented five-star comments, clearly labeled as featured reviews.
Do not invent identities, quotes, ratings, or verified-user claims.

## Scope And Privacy

Keep the existing Google Form and brand account. Bind a Google Apps Script to
that form with current-document-only authorization. An hourly private refresh
reads responses and stores only a public-safe snapshot. A public read-only web
app serves that prepared snapshot; it never reads raw responses on a visitor's
request, accepts writes, returns timestamps or nonconsenting names/comments, or
accepts arbitrary file identifiers. No raw response sheet or CSV becomes public.

The website continues loading same-origin static JSON. A GitHub Actions workflow
reads the public snapshot hourly, validates it, saves changed data only, and
deploys Pages. No paid service, new app dependency, app telemetry, email
collection, mandatory reviewer sign-in, or Codex recurring job is added.

## Data Rules

- Count every valid 1-5 submission, including critical, unfeatured, and
  nonconsenting responses. Explicitly exclude setup-test entries and repeated
  source response identifiers. This is submission counting, not unique people
  or verified installations; anonymous forms cannot guarantee spam prevention.
- Feature only five-star comments with the exact existing publishing consent.
  Keep names and comments unchanged. Skip empty/overlength comments, identical
  or near-identical featured text, and obvious contact-detail/link payloads.
  Filtering cards must never remove a valid rating from the aggregate.
- Keep at most ten comments with deterministic selection. Recompute from the
  full source on refresh so repeated runs cannot double-count.
- Fail closed on changed form fields, malformed source data, uninitialized
  snapshots, invalid public fields, or network failures. Retain the last good
  public website snapshot. Use locking for atomic prepared-snapshot reads.
- Label the carousel as featured reviews. Aggregate wording says
  submitted ratings, not independently verified genuine people.

## Review Layout Follow-Up

Center the aggregate on its own above the cards. Move the review action below
the cards and optional navigation. Remove the long visible policy paragraph;
keep only a subdued "Featured reviews" caption, with full rating/selection
context in accessible descriptions and tooltips. Localize EN/ES, preserve data
and averaging rules, and verify center alignment and mobile overflow. The
coordinator implements this narrow frontend change directly. It can be
published independently of the pending one-time Google authorization.

## Implementation Sequence

1. Implement and test the bound-form refresh/selection/feed using a single
   Sol/high specialist. Coordinator owns browser setup and approval boundary.
2. Extend static snapshot validation/import fallback to ten cards; build a
   responsive swipeable carousel with keyboard-accessible arrows, no autoplay,
   and unchanged hero/screenshot/download behavior.
3. Add a narrowly scoped sync command/workflow with validation, atomic writes,
   no raw-response logs, last-good-data behavior, no-op updates, and deployment.
4. Authorize the bound script once with explicit user approval at the Google
   permission prompt; deploy the prepared public feed and verify its contents.
5. Verify mixed ratings, consent, duplicates/test entries, invalid/failing
   feeds, stored snapshots, ten cards, language, keyboard/swipe, desktop/mobile,
   existing website tests, and actual native hosted sync/deployment.

## Ownership And Acceptance

The coordinator owns integration, tests, privacy review, authorized publishing,
and runtime evidence. The specialist edits only its assigned backend source and
tests; it does not publish, commit, authorize accounts, or operate the browser.

Complete means existing submissions render unchanged; low ratings affect the
aggregate without needing approval; selected comments remain consented; the
hourly Google trigger and hourly GitHub workflow are verified; and the site is
live with no new manual review chore. Google/GitHub can delay schedules or
disable jobs after extended inactivity; do not promise real-time or permanent
zero-maintenance operation. If Google authorization is pending, preserve tested
code and working current data and report that concrete limitation.

## All Reviews Follow-Up (2026-10-05)

- Keep the existing ten-card featured carousel. The two new consented five-star
  submissions come first, followed by eligible feedback newest first.
- Add an accessible count button opening a compact native dialog in the existing
  glass style. Show consented public comments of every rating, newest first,
  ten at a time with navigation, close, Escape/backdrop dismissal, and focus
  return. Preserve the hero, screenshots, downloads, and review-form link.
- Schema version 2 adds `reviews` to the existing public-safe snapshot. Each
  review retains only id, rating, comment, and consented display name. No raw
  timestamps, consent records, response IDs, or private data enter Git.
- All valid ratings continue contributing to the average. Public comments obey
  existing consent, length, and contact-detail safety rules. The dialog explains
  why ratings without public comments do not have a visible review card.
- Retain schema-1 client compatibility. Never replace a schema-2 snapshot with
  a schema-1 feed that would lose the full public-review collection.
- Bound the Google prepared snapshot to 200 KB and fail without replacing the
  last good snapshot if storage capacity is exceeded. Use atomic generation
  switching; do not silently truncate the full review collection. Larger
  archives will require an explicit storage architecture update.
- Coordinator owns frontend, source-checked data preparation, documentation,
  browser QA, permissions, and any separately authorized publication. One
  GPT-6.1 Sol/medium worker owns the schema validator, feed, sync, manual importer,
  and their tests. Neither app nor installers change.
- Acceptance: 36 valid ratings / 178 stars, newest two comments first, all 36
  currently consented comments accessible including both four-star reviews;
  desktop/mobile EN/ES, keyboard focus, literal hostile text, pagination,
  consent filtering, failed sync/storage preservation, and unchanged downloads.

## Dated Reviews And Publication (2026-10-05)

- Publish the current website follow-up as authorized by the owner. Preserve
  the existing app, installers, download counter, and website layout.
- Add optional ISO calendar `date` and `dateType` (`submitted` or `imported`)
  metadata to public review records. Show localized dates only in All Reviews,
  never the featured carousel. Do not publish precise response timestamps.
- Submitted dates come from the source form in America/Los_Angeles. The 30
  historical records identified by the existing private import receipt remain
  undated in the UI, with import provenance retained only in the data. Do not
  invent original dates or distribute reviews over an unsupported timeline.
- A public-safe fingerprint map identifies historical imports by exact rating,
  trimmed comment/name, and a canonical UTC response instant truncated to a
  second inside the hash only. No raw timestamp enters the public payload;
  identical text submitted later is not mislabeled
  as an import. Future submissions use their own
  actual source dates; unknown legacy dates stay absent rather than guessed.
- Keep all old schemas/undated records readable. Validate paired date metadata,
  exact Gregorian calendar dates, allowed provenance, and featured membership.
- Automatic total/average/full-public-comments updates must be connected and
  verified. Google current-form/trigger authorization is a one-time owner step,
  not per-review approval. Never silently claim auto-sync is live while pending.
- One Sol/medium worker updates backend date validation/feed/import/tests.
  Coordinator owns frontend display, known import map/data, browser setup,
  permissions, commit/push, live deployment, and end-to-end evidence.

## Recovered Historical Dates (2026-10-05)

- Match all 30 rows in the owner's dated feedback workbook by exact name,
  rating, and comment. Preserve review IDs, wording, ratings, consent, and totals.
- Add the source-provided original feedback dates to a fingerprint map in the
  existing form-bound feed. `submitted` dates mean when feedback was first
  provided, whether by the form or the historical messages recovered by the
  owner. Unknown historical dates remain hidden as before.
- Sort by the original feedback calendar date, using original source time and
  ID only to break ties. Keep exact-source fingerprinting so a later identical
  submission does not inherit an earlier date. Keep schema and cached-client
  compatibility unchanged; do not create duplicate form responses.
- Refresh the prepared Google snapshot with the tested saved script, sync both
  website snapshots, and publish. Verify unchanged totals and review content,
  all 30 provided dates, newest reviews first, and no visible import labels.
- Keep the workbook and raw responses outside Git. This is a tightly coupled
  feed/data/UI integration; the coordinator implements locally without a new
  specialist or model escalation.

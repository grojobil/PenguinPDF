# Website Reviews

## Objective And Scope

Collect real PenguinPDF feedback through a free Google Form owned by
penguin.pdf.tools@gmail.com. Add a compact, localized review section below the
screenshots and above the release/mobile links. Preserve the hero, downloads,
carousel, installers, and app privacy behavior.

## Automatic Publishing Policy

- Collect a required 1-5 rating, optional feedback/display name, and explicit
  permission to publish the optional name and comment.
- Keep raw responses private. Never commit response exports or email addresses.
- All valid submitted 1-5 ratings contribute to the average, including critical
  feedback, unfeatured comments, and submissions without publishing consent.
- Feature up to ten consented five-star comments, choosing recent distinct
  feedback. Keep quotes and consented names unchanged. Skip empty, overlength,
  near-duplicate, and obvious contact-detail/link payloads from cards only.
- The clickable rating count opens a paginated all-reviews dialog. Include
  public-safe, consented comments of every rating, newest first; ratings without
  a public comment still count toward the average. Schema 2 stores the full
  public collection separately from the ten featured comments.
- Exclude explicitly labeled `QA TEST` entries and repeated source response
  identifiers. Anonymous submissions are not verified people or installations;
  this does not detect every spammer or repeated submission by the same person.
- Label cards selected five-star reviews. Selection never changes the average.
- Initially show an invitation to leave feedback, with no fabricated stars,
  quotes, reviewers, or empty cards. Hide the average until ratings exist.

## Implementation

The user's visual reference adds a centered soft tag, the headline "Simple.
Powerful. Actually useful.", glass cards, warm-gold stars, and small author
initials. Keep the existing hero and screenshot carousel unchanged. Initials
come only from a consented display name; do not invent photographs, job titles,
reviews, or ratings. Before real ratings arrive, show the invitation and review
link without an average, testimonial cards, or meaningless pagination dots.

1. Create and verify the brand-owned feedback form, responder access, optional
   publishing consent, and disabled email collection/sign-in requirement.
2. Save its responder URL and an empty public review snapshot.
3. Bind the tested Apps Script to the existing form and authorize it once.
4. Render responsive glass review cards and localized aggregate/empty/failure
   states using text nodes, not raw HTML from submitted content.
5. Test import validation, consent, unbiased average, hostile input, failure
   handling, language changes, and existing download routing.
6. Set an hourly Google refresh and an hourly GitHub Actions sync. Validate the
   prepared public feed before updating the static website snapshot and Pages.
   Preserve the last good data on failures; skip timestamp-only commits.

## Architecture And Ownership

The existing static GitHub Pages site reads a same-origin JSON snapshot. No
external widget, paid service, analytics, or app telemetry is added. A
form-bound Apps Script reads responses privately during its hourly refresh.
Its public `doGet()` serves only an already-prepared snapshot, never raw form
responses. Current-document authorization limits Forms access to this form;
Google also requires permission to create and run the clock trigger.

The GitHub workflow fetches that public-safe snapshot, validates its exact
fields, and publishes only changed aggregate/consented review data. Website
visitors never contact the script or Google until they follow the optional
feedback link. See `REVIEW-AUTOMATION-PLAN.md` for the implementation boundaries.

## Acceptance

- Form accepts feedback without requiring a Google login or PDF upload.
- Consent is optional and unchecked; email collection is disabled.
- Average includes every valid submitted rating, even when its
  comment is not featured or publication consent is declined.
- No consent means no public comment/name. No rating means no public average.
- Submitted text cannot inject markup. Invalid snapshots do not break the site.
- The bounded review carousel fits mobile/desktop, supports arrows and keyboard
  navigation, and does not change the existing screenshot/download behavior.
- EN/ES copy, keyboard access, loading/failure behavior, and live deployment
  are verified. No raw feedback is published without authorization/consent.

## Normal Owner Workflow

- [Private responses dashboard](https://docs.google.com/forms/d/1lzXxFY48a3T8KtpanpeGh1UblQh2wbJSS2nnKCw5Wis/edit#responses),
  accessible with the PenguinPDF Google account. The URL does not grant access.
- [Public feedback form](https://docs.google.com/forms/d/e/1FAIpQLSdDG363hP184VcRrEbm67f1sHMdC1gQ4e8KNolZITTuYUiQAA/viewform?usp=header).
- No per-review approval, export, or commit is needed once the automation is
  connected. Google and GitHub each refresh hourly; changes are not real-time
  and can take roughly two hours plus scheduler/deployment delays.
- The private dashboard remains available for reading feedback. Never publish
  the response summary, a raw response spreadsheet, or a private CSV export.
- If automation fails, the current public snapshot stays visible. GitHub Actions
  and Apps Script executions show failures; owner permissions and schedules can
  require attention if revoked, changed, or disabled by the service.

## Emergency Manual Fallback

`scripts/update-reviews.py` remains available if the automatic feed is offline.
Download a full CSV export from Responses -> More options. Keep that export and
moderation decisions outside Git. Make a decision for every record, include all
genuine ratings regardless of score, and exclude only confirmed inauthentic/test
entries. `row` is a CSV record number including the header, not a physical line.
Select at most ten consented comments; never invent or edit quotes/names. A
manual snapshot will be replaced by the next successful automatic refresh.
The full snapshot is `docs/reviews-v2.json`; `docs/reviews.json` is the
featured-only compatibility feed for cached older pages. The normal sync
updates both together, including all ratings in both averages.

From the public repository root:

```sh
python3 scripts/update-reviews.py /private/path/Feedback.csv.zip --inspect
python3 scripts/update-reviews.py /private/path/Feedback.csv.zip --moderation /private/path/moderation.json
node --test scripts/test-download-stats.mjs scripts/test-downloads.mjs scripts/test-reviews.mjs scripts/test-reviews-sync.mjs scripts/test-reviews-feed.mjs
python3 scripts/test-reviews-import.py
git diff -- docs/reviews.json
```

Example private decisions (not real reviews):

```json
[
  { "row": 2, "status": "genuine", "feature": true },
  { "row": 3, "status": "genuine" },
  { "row": 4, "status": "exclude", "reason": "Confirmed spam" }
]
```

The maintenance importer uses Python 3's standard library only, not an app
dependency or conversion engine. The app and installers are unchanged. The
website loads no Google widget, tracker, or form until a visitor follows the
optional feedback link.

## Initial Manual-Feature Evidence

- Published form: rating required, other fields optional, publication consent
  unchecked, no email collection or required sign-in, response summaries private.
- One submission labeled `QA TEST` verified the form and private CSV export.
  Its consent is false; it is explicitly excluded from the initial public
  snapshot and must remain excluded in future full imports.
- Local desktop/mobile EN/ES checks: three-column and single-column cards,
  accessible 1/4/5-star labels, literal submitted text, no horizontal overflow,
  fixed bottom-right language switch. Temporary layout examples are not
  published. Initial public snapshot is zero ratings and no comments.
- Website tests and importer tests also run before every Pages deployment.
- Final local checks: 43 website tests and 10 importer tests passed; Git whitespace
  checks passed. Narrow-screen checks at 320px and 390px have no horizontal
  overflow. No installer, app, carousel, or download-routing changes are included.

## Automation Verification

- 65 Node tests and 10 Python importer tests pass: mixed ratings, consent,
  duplicate/test filtering, form-schema changes, private-field rejection,
  snapshot storage failures, no-op updates, and atomic local writes.
- Ten-card desktop/mobile preview uses clearly labeled test data outside Git.
  The published snapshot remains the two actual consented reviews.
- Google project source is saved as `PenguinPDF Automatic Reviews` in the brand
  account. Its saved source now matches the tested local script. Owner completed
  Google authorization on October 5; setup completed and the Every hour trigger
  was inspected. The public-safe web-app feed was deployed and fetched without
  credentials, returning all 36 consented comments and the complete average.

## All-Reviews Verification (2026-10-05)

- Private full-form export contains 37 submissions: one explicitly labeled
  setup test and 36 actual ratings totaling 178 stars. All 36 current comments
  have the exact publication consent. Both four-star comments remain visible
  in the full collection; the ten-card carousel contains five-star feedback.
- The prepared website snapshot puts the two new form submissions first and
  retains all historical ratings. Names and quotes match the export; no raw
  export, timestamps, or consent records are copied into public files.
- All-reviews dialog: ten comments per page, newest first, native modal focus
  containment and Escape dismissal, backdrop/close dismissal, focus return,
  bounded scrolling, and EN/ES labels. No app or installer changes.
- The full collection must not be downgraded to the older featured-only feed.
- Verification passed: 95 Node website/backend/privacy checks and 14 Python
  importer checks. Browser preview reached all 36 exact source comments across
  four pages, including two four-star comments; Escape and close restore count
  focus. EN/ES dialogs fit desktop, 390px, and 320px viewports without horizontal
  overflow; the header and pagination remain outside the scrolling list.
- Prepared snapshots are limited to 200 KB / 5,000 public comments; storage
  overflow keeps the last good snapshot rather than publishing a partial
  collection. Archives beyond that limit require a reviewed storage change.

## Dated Review Sync

- Dates display only in All reviews. Six direct form submissions use their
  real submitted calendar day in America/Los_Angeles. Thirty records matched
  to the original private import receipt are labeled Imported Sep 29, 2026;
  original oral-feedback dates were not supplied and are not invented.
- Import fingerprints include canonical source time (seconds) inside a hash,
  so the same comment submitted later does not inherit an old import label.
  Public records contain only the calendar date and submitted/imported label,
  never the source timestamp or private response identifier.
- `REVIEWS_FEED_URL` is configured as a GitHub repository variable. The hourly
  review workflow reads the prepared public feed, validates it, changes only
  the review snapshot, and deploys Pages when data changes. The workflow skips
  safely if the configuration is removed. Ratings need no individual approval;
  comments still require the publication permission in the review form.
- Refreshes run hourly on Google and GitHub. Allow roughly two hours plus
  scheduler/deployment delays; failures preserve the last good website data.
- Final local checks: 104 Node tests and 18 Python importer tests pass, including
  real calendar validation, paired date metadata, late repost provenance,
  private-field rejection, lower ratings, storage failures, and legacy data.
- Live deployment exposed an older-page cache path, so the public legacy JSON
  format is retained separately. New clients fetch the full versioned archive;
  cached old clients continue showing valid totals and featured comments.
- Website deployments and data refreshes share a serialized workflow group.
  Main-page builds use current `main`, avoiding an older queued build restoring
  stale review counts after a newer automatic refresh.

# Website Reviews

## Objective And Scope

Collect real PenguinPDF feedback through a free Google Form owned by
penguin.pdf.tools@gmail.com. Add a compact, localized review section below the
screenshots and above the release/mobile links. Preserve the hero, downloads,
carousel, installers, and app privacy behavior.

## Data And Moderation

- Collect a required 1-5 rating, optional feedback/display name, and explicit
  permission to publish the optional name and comment.
- Keep raw responses private. Never commit response exports or email addresses.
- Import a private CSV export locally. The public snapshot contains only an
  aggregate of all valid, approved-as-genuine ratings and explicitly selected,
  consented comments. Reject spam, duplicate responses, and test entries based
  on authenticity, never merely because the rating is low.
- Featured comments are labeled selected feedback. Their selection must not
  change the overall average. Do not claim verified installations or users.
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
3. Add a dependency-free local importer and documented moderation workflow.
4. Render responsive glass review cards and localized aggregate/empty/failure
   states using text nodes, not raw HTML from submitted content.
5. Test import validation, consent, unbiased average, hostile input, failure
   handling, language changes, and existing download routing.
6. Verify the responder form and desktop/mobile site before publishing the
   website-only changes. Delete test submissions through normal recovery when
   supported, or exclude them explicitly from the public snapshot.

## Architecture And Ownership

The existing static GitHub Pages site reads a same-origin JSON snapshot. No
server, external widget, paid service, analytics, or app telemetry is added.
New responses are collected automatically in the form; public reviews update
after owner moderation and a reviewed commit. The coordinator owns integration,
tests, runtime verification, and authorized publishing; no specialist is needed
for this bounded website/form change.

## Acceptance

- Form accepts feedback without requiring a Google login or PDF upload.
- Consent is optional and unchecked; email collection is disabled.
- Average includes every valid rating in the moderated import, even when its
  comment is not featured or publication consent is declined.
- No consent means no public comment/name. No rating means no public average.
- Submitted text cannot inject markup. Invalid snapshots do not break the site.
- Review cards fit mobile/desktop without changing existing download behavior.
- EN/ES copy, keyboard access, loading/failure behavior, and live deployment
  are verified. No raw feedback is published without authorization/consent.

## Owner Workflow

- [Private responses dashboard](https://docs.google.com/forms/d/1lzXxFY48a3T8KtpanpeGh1UblQh2wbJSS2nnKCw5Wis/edit#responses),
  accessible with the PenguinPDF Google account. The URL does not grant access.
- [Public feedback form](https://docs.google.com/forms/d/e/1FAIpQLSdDG363hP184VcRrEbm67f1sHMdC1gQ4e8KNolZITTuYUiQAA/viewform?usp=header).
- Responses -> More options -> Download responses (.csv). Google currently
  downloads a CSV.zip file; the importer accepts that or a plain CSV.
- Keep the export and moderation JSON in a private local directory outside the
  repository, not in `docs/`. Never publish them, even in this public repo.
- Inspect locally using the command below. `row` is a CSV record number (header
  is row 1), not a physical line number; multiline comments remain one record.
- Make one decision for every row. Mark all genuine ratings `genuine`, including
  critical/low ratings. Exclude only confirmed spam, duplicates, test entries,
  or other inauthentic responses, and record a private reason. There is no
  verified-download identity or automatic duplicate-user detection.
- Select up to six consented comments with `feature: true`; any genuine rating
  contributes to the average regardless of consent or featured status.
- Review selected comments for personal/document information before featuring
  them. Do not edit quotes or silently shorten them; comments over 600 characters
  and names over 60 cannot be featured by the importer.
- Use a fresh full export and fresh decisions each time. The snapshot replaces,
  rather than accumulates, ratings so repeated imports do not double-count.
- Review `docs/reviews.json`, run the tests, and commit only that public snapshot
  to update the site. Submissions arrive automatically in Forms; publishing is
  deliberately moderated, not automatic. No recurring job is created.

From the public repository root:

```sh
python3 scripts/update-reviews.py /private/path/Feedback.csv.zip --inspect
python3 scripts/update-reviews.py /private/path/Feedback.csv.zip --moderation /private/path/moderation.json
node --test scripts/test-download-stats.mjs scripts/test-downloads.mjs scripts/test-reviews.mjs
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

## Verification Evidence

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

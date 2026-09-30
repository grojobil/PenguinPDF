# Website Analytics

The private dashboard is https://penguinpdf.goatcounter.com/. Sign in using
the PenguinPDF account. No API key or analytics account is required by visitors.
This integration is only in the public website, not the desktop application.

## Reading The Dashboard

- `/PenguinPDF/`: approximate unique homepage visits.
- `download-installer`: approximate unique visits that clicked any installer.
- `download-macos-apple-silicon`, `download-macos-intel`,
  `download-windows-exe`, and `download-windows-msi`: installer choices.
- Top referrers: referring domains when the browser supplies them. Missing
  referral data does not prove that the visitor came directly.
- Campaigns: homepage visits associated with a tagged link. For installer
  attribution, select `download-installer` or a platform event and read its
  Top referrers. Tagged clicks have a label such as `facebook / video-ad`.
  GoatCounter does not populate its Campaigns widget from event query tags.

The any-installer event and format-specific event describe the same click.
Do not sum them, or add events to homepage visits to claim a number of people.
GoatCounter deduplicates each path/event for a session lasting up to eight
hours. This is not lifetime unique users; shared networks, changing IPs,
different browsers/devices, and repeat visits on later days affect estimates.

Installer clicks are not completed downloads, installs, or active users. Direct
GitHub downloads, blocked analytics, privacy opt-outs, and lost requests are
not attributed by this integration. Existing historical GitHub counts cannot
be retrospectively attributed. The public download sticker continues using
GitHub asset counts, including repeat/test downloads, on its six-hour refresh.

## Facebook Campaign Links

Use a separate `utm_campaign` for each creative. Example destination URLs:

- Video ad: https://grojobil.github.io/PenguinPDF/?utm_source=facebook&utm_campaign=video-ad
- Image ad: https://grojobil.github.io/PenguinPDF/?utm_source=facebook&utm_campaign=image-ad
- Facebook organic: https://grojobil.github.io/PenguinPDF/?utm_source=facebook&utm_campaign=organic
- X organic: https://grojobil.github.io/PenguinPDF/?utm_source=twitter&utm_campaign=organic
- Reddit: https://grojobil.github.io/PenguinPDF/?utm_source=reddit&utm_campaign=organic

Only `utm_source` and `utm_campaign` values consisting of 1-80 letters, digits,
hyphens, or underscores are transmitted. Use campaign codes, never names,
email addresses, document names, or other personal data. Other query data,
including `fbclid`, is not forwarded. Referrer paths and queries are stripped.
Visits receive the sanitized query tags. Installer events carry the same codes
in their referrer label, because GoatCounter ignores query tags on events.
With no tags, an event retains the referring domain. A source-only label is
`source:facebook`; a campaign-only label is `campaign:video-ad`. These labels
describe attribution, not extra clicks or identities.

Website integration alone does not change existing ad destinations. Updating
active ads may require review; this task does not change ad spend, targeting,
creatives, or publish changes to campaigns. Compare recorded installer-link
clicks per campaign with that campaign's actual spend to estimate cost per
installer click, not cost per installed or active user.

## Privacy And Owner Exclusion

The dashboard stays restricted to logged-in users. Individual pageview storage
stays off. Sessions/referrers, browser/system categories, and approximate
country are enabled. Screen-size and sub-country region collection are not
needed for this implementation and are disabled. No analytics cookies,
persistent visitor identifiers, app telemetry, or uploaded documents are added.

The homepage has a localized Privacy link to `docs/privacy.html`. It explains
the actual data flow and limits, without claiming universal legal compliance.
Requests use omitted credentials and no Referer header. Do Not Track, Global
Privacy Control, `analytics=off`, and GoatCounter's existing `skipgc=t` local
browser preference suppress collection. Download navigation remains unchanged
if requests are blocked, unavailable, or fail.

To view the website without contributing to analytics, append
`?analytics=off` (or `&analytics=off` to a URL that already has parameters).
This applies only while the option is in the URL. Existing browser opt-outs
from GoatCounter are also respected; no new preference is written by this code.

## Controlled QA

`?analytics=qa` records the separate `/qa-page-view/` page and `qa-download-*`
events. These are clearly separate from organic page and installer events. QA tags
may be used, but no actual campaign is implied. The dashboard may batch data
before showing a hit. Tests must never be relabeled as genuine users.

Run:

```sh
node --test scripts/test-analytics.mjs scripts/test-downloads.mjs scripts/test-download-stats.mjs scripts/test-reviews.mjs
```

The integration uses native browser requests matching the public protocol
observed in GoatCounter's official client: https://gc.zgo.at/count.js.
Event campaign handling was verified against GoatCounter's `Hit.Defaults`:
https://github.com/arp242/goatcounter/blob/master/hit.go.
GoatCounter owns session counting and aggregation. No external executable
script, analytics dependency, token, or backend is bundled with PenguinPDF.

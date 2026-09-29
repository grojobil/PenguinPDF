# Website Statistics

## Scope

Display a small, localized, non-clickable recorded-download badge on the website.
Keep recorded statistics and history available to the owner. The data is public.
Keep installer totals separate from visitors, button clicks, and installations.
No app telemetry, cookies, paid service, or private-source publishing is added.

## Download Totals

`docs/downloads.json` stores the highest observed GitHub count for each installer
asset ID, plus totals by platform and release. Only stable, published PenguinPDF
DMG, EXE, and MSI assets count. Checksums, source archives, drafts, and prereleases
do not count. Repeat downloads and QA downloads are included; unique users and
successful installations cannot be inferred.

The baseline includes v1.0.0 and the replacement v2.0.0 installers visible on
September 29, 2026. Counts for previously deleted assets are unknown and excluded.
This is a recorded total, not a complete lifetime total.

The GitHub workflow refreshes the snapshot every six hours, on release edits,
and on manual dispatch. It uses public-repository Actions, with no paid service
or visitor-side GitHub API calls. The page reads one same-origin JSON snapshot.
Lookup failures leave the last published snapshot unchanged; malformed JSON is
not displayed. The GitHub token stays in Actions and is never shipped to browsers.

Owner access:

- Current totals, platform/release breakdowns, and update timestamp:
  https://grojobil.github.io/PenguinPDF/downloads.json
- Timestamped snapshot history, starting September 29, 2026:
  https://github.com/grojobil/PenguinPDF/commits/main/docs/downloads.json
- Refresh status and manual refresh:
  https://github.com/grojobil/PenguinPDF/actions/workflows/download-stats.yml
- Repository views/clones (not website traffic or installer downloads):
  https://github.com/grojobil/PenguinPDF/graphs/traffic

Before replacing or deleting release assets, run the refresh workflow and wait
for success. Removed IDs remain in the ledger, so their observed counts survive
replacement, even when the release version is reused. Downloads between the last
snapshot and deletion cannot be reconstructed; do not delete the ledger.

Local refresh and tests:

```sh
node scripts/update-download-stats.mjs
node --test scripts/test-download-stats.mjs scripts/test-downloads.mjs
```

## Visitor Analytics

The owner chose to defer visitor analytics. No visitor analytics script or event
collection is installed on the site.

GoatCounter is a free, donation-supported option for a private dashboard of
approximate unique visits and download-link events. Account setup must be
completed by the owner before integration; no guessed account is enabled.
It deduplicates site/IP/browser combinations for eight hours without browser
cookies or permanent identifiers. Repeat visits on another day, network, or
browser can count again; blockers can prevent collection. These are estimates
of website visits, not unique app users or installations.

If enabled, retain aggregate-only collection, keep the dashboard private, omit
query strings and unnecessary location/screen data, respect privacy signals,
document collection on the site, and track only actual installer-link clicks
(not opening a platform chooser). Do not change app privacy behavior.

Official references:

- https://docs.github.com/en/rest/releases/assets
- https://www.goatcounter.com/
- https://www.goatcounter.com/help/sessions
- https://www.goatcounter.com/help/privacy

## Acceptance

- Test snapshot merging, asset replacement, malformed data, and API pagination.
- Verify the badge is non-clickable, localized, and hidden when statistics fail.
- Verify desktop/mobile layout and existing download chooser/carousel behavior.
- After authorized publication, verify the live badge and retained statistics.
- Do not claim visitor analytics is active until its dashboard receives a test event.

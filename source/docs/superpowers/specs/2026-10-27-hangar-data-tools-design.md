# Hangar Data Tools Design

## Intent

Make My Gear easier to audit and reuse by showing pledge identifiers, base pledge names and RSI-provided melt values; filter the indexed hangar by ship/item type, LTI, giftable/reclaim status, Warbond and value; cache the local index; and export CSV plus a Hangar Transfer Format ship list.

## Constraints

- Run only on the enabled My Gear Hangar route and use the existing same-origin, read-only page scan.
- Treat RSI-rendered fields as the source of truth. Unknown values stay unknown; do not infer a monetary value or insurance state from unrelated text.
- Keep pledge data in local extension storage, separate from settings and favourites. Do not transmit it.
- Reuse native pledge cards and preserve RSI actions. No card cloning or destructive account actions.
- Keep search available while sequential background preloading runs; never delay the native Hangar page.

## Approach

One normalized pledge record will feed card metadata, cross-page search/filtering, and both exports. This avoids separate parsers drifting apart. The cache stores only normalized pledge fields with a schema version, first-page fingerprint, page count and expiry; it does not store page markup. CSV exports every pledge record. Hangar Transfer JSON exports contained ships with pledge metadata and marks ship codes that could not be resolved from a catalogue.

The alternatives were separate parsers per feature (more duplication), caching raw card HTML (stale controls and unnecessary private data), or one normalized local index (selected because the current search already indexes all pages). Preloading begins after a 1.5-second delay; a valid warm cache lets searches skip the cross-page fetch. Fixture tests verify it without measuring real account latency.

## Acceptance

- IDs, base names and melt values display only when present in native Hangar markup.
- Filters cover available pledge/item type, LTI, giftable/meltable, Warbond, and numeric value fields across indexed pages.
- CSV and Hangar Transfer Format downloads include every indexed page and escape user-controlled text safely.
- Cache expires, rejects a changed first-page fingerprint, and can be refreshed without touching other extension data.
- Page discovery remains sequential, same-origin, read-only, retryable, and reports incomplete scans.
- Focused fixtures verify background preloading and immediate warm-cache searches; live account timing remains unverified.

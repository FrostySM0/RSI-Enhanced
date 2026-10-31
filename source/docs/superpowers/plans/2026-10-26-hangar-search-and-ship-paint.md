# My Hangar Search and Ship Paint Implementation Plan

**Goal:** Search all Hangar pages for every matching pledge, and show Ship Paint matches as compact pages assembled from every native Hangar page.

**Architecture:** Sequentially index verified same-origin pagination links, starting from the already-scanned current DOM. Retry transient page failures once and continue through other links. Match pledge titles, Contains summaries and expanded details. Keep the native card nodes in memory and move paint matches into combined pages using the fullest native page size discovered; restore the original current-page rows and native pager when Ship Paint is cleared.

**Spec:** `docs/superpowers/specs/2026-10-26-hangar-search-and-ship-paint-design.md`

## Constraints

- Read pages sequentially with same-origin credentials; do not call write/action APIs or persist the index.
- Follow only same-origin Hangar URLs with page-only query parameters.
- Use native `.js-pledge-id` values, `textContent` for output, and no cloned pledge cards.
- Include paints named in package details, not only pledge titles.
- Clean up local filter/search state when Hangar is disabled or the route changes.
- Do not inspect the user's browser. Run only focused Hangar tests and directly affected build/type checks.

## Completed work

- [x] Add the extension-owned **Ship Paint** option without changing native filter navigation.
- [x] Combine paint cards across all discovered pages into full result pages; preserve native nodes/actions, keep selection while paging, and restore native rows when switching category.
- [x] Index all reachable Hangar pages sequentially and search title/summary/details without a result cap.
- [x] Reuse the current DOM instead of refetching the active page, and continue across other discovered pages if a fetch fails.
- [x] Link results to their source page and pledge ID, including deep pages.
- [x] Add runtime coverage for pages 1 → 2 → 15, `RSI Disc` detail matches, a temporary 503 retry, persistent page-failure reporting, combined Ship Paint pages, category restoration, and module cleanup.
- [x] Run focused Hangar tests, scoped TypeScript, and extension build.

## Verification

- `node --test tests/hangar-search.test.mjs tests/hangar-search-runtime.test.mjs tests/hangar-controls.test.mjs`
- `pnpm exec tsc -p tsconfig.settings.json`
- `pnpm build`

Ship Paint indexes all reachable native pages, then presents their matching pledge cards through extension-owned paging controls. Cross-page text search remains independent and returns links to the original page and pledge.

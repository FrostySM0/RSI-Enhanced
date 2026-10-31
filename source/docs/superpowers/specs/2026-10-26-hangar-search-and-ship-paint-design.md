# My Hangar search and Ship Paint filter

## Intent

Make My Hangar search discover matching pledges across native pagination, and add a Ship Paint choice that combines matching native pledge cards from every page into compact, fully populated result pages.

## Behavior

- Search all linked, same-origin Hangar pages sequentially after a non-empty query. Match pledge titles, the visible “Contains” summary, and expanded item details. Return every match, without an arbitrary result cap, and link it to the source page and stable pledge ID.
- Add **Ship Paint** to the existing type dropdown. Match native cards whose title, “Contains” summary, or expanded details mention paint. Gather those cards across all linked pages and repaginate them using the fullest native page size found, so early sparse pages do not leave gaps. Keep the native card nodes, layout and controls; provide an extension pager for the combined result pages. Keep Ship Paint selected while moving between native Hangar pages in the same tab.
- Selecting a normal native category restores all cards hidden by Ship Paint. Disabling the Hangar module or leaving the route removes the local option and temporary filter state.

## Constraints

- Follow only same-origin page-only pagination URLs and read pages sequentially with same-origin credentials. No write/action APIs or persisted Hangar index.
- Use `.js-pledge-id` for stable links and render result text with `textContent`.
- Do not clone native pledge cards or invent an RSI Ship Paint route.
- Search starts from the current page's already-scanned DOM and follows linked same-origin pagination pages without refetching that first page. A failed page fetch must not prevent visiting other discovered pagination links.
- Retry transient page-load failures once before reporting partial results; keep listing reachable matches and identify which page failed so the user can retry.
- Do not clone native pledge cards; move the existing native card nodes into the combined page view and restore the original current-page nodes when leaving Ship Paint.

## Verification

- Unit tests cover title/details paint classification, untruncated search matches and safe page links.
- Runtime fixtures follow pagination from pages 1 through 2 to 15, find “RSI Disc” matches in details, verify the exact source-page link, verify transient retry and partial-failure reporting, and confirm Ship Paint combines sparse pages into full pages while preserving/restoring native card nodes.
- Run only focused Hangar tests, scoped TypeScript and the extension build. Do not inspect the user's browser.

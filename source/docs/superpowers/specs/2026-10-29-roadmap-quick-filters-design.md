# Roadmap Quick Filters

## Intent

Make it easier to narrow Roadmap Release View search results by status and category without taking space away from the patch columns.

## Goals

- Add a compact **Filters** button beside the existing Roadmap card search.
- Open a small popover with status checkboxes for Tentative, Committed, and Released, plus a category selector.
- Combine selected filters with the existing text query so a result must satisfy both.
- Keep filters local to the search result list. Selecting a result continues to expand only its category when needed, jump to the patch/card, and show the existing red highlight.
- Include cards from previous releases using the existing search index and archive-loading flow.
- Keep the popover accessible by keyboard and visually consistent with the existing Roadmap search panel.

## Non-goals and anti-goals

- Do not change the native Roadmap columns or hide cards/categories on the board.
- Do not expand every category when focusing or typing in search, or when opening the filter popover. Expand only the selected card's category when a result is chosen.
- Do not add a “recently updated” sorting mode, new data source, or network request.
- Do not alter native card activation, archive behavior, or the existing search index strategy.
- Do not persist filter selections across sessions; they are temporary search refinements.

## Behavior

- The filter button sits beside the search field and shows an active count when any filter is narrower than the defaults.
- By default, all three statuses are selected and category is **All categories**, so opening filters does not change results.
- Status options are multi-select. Category is a single-select dropdown with **All categories** followed by categories found in the indexed cards.
- The result set is the intersection of the text query, selected statuses, and selected category. With an empty text query, selected filters can show matching cards in the existing result panel.
- Previous-release cards remain eligible; category options and results update as the current archive loader adds cards to the index.
- The existing result count, no-match message, keyboard result navigation, and jump/highlight behavior continue to work with filtered results.
- **Clear filters** restores all statuses and **All categories** without clearing the search text.
- The popover closes on Escape, outside click, or focus leaving the combined search/filter control. Focusing or typing in search, and opening the popover, do not change category expansion state.

## Layout and interaction

Use the selected **Filter popover** mockup direction. The popover is anchored to a button in the search control row, uses a compact dark panel with a clear heading, status checkbox group, category selector, and a Clear filters action. On narrow widths it aligns to the search container and stays within the viewport. The results dropdown remains below the search row and may remain open while filters are adjusted.

## Constraints and implementation approach

- Extend `src/content/roadmap-search.ts` and `src/styles/rsi/roadmap.css`; keep the feature Roadmap-route scoped.
- Build category options and filter predicates from the existing in-memory `indexedCards` map. Do not add a separate index or observer.
- Keep card identity and result navigation tied to the existing native anchors, including archived cards.
- Update the focused Roadmap search tests to cover default/no-op filters, status and category intersections, previous-release matches, filter clearing, keyboard dismissal, and selection navigation.
- Avoid unrelated tests; run only the focused Roadmap search test and build if the changed feature requires packaged output.

## Alternatives considered

- **Inline chips:** Always-visible status and category controls would be quick to reach, but take header space and crowd the compact Roadmap layout.
- **Filter popover (selected):** Keeps the header compact while exposing the same filters on demand; it adds one click and needs careful focus/outside-click handling.

The popover is selected because it matches the user's preference and preserves the existing header layout.

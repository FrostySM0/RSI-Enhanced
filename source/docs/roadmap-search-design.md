# Roadmap card search

## Goal

Make cards already loaded in the Roadmap board easy to find without changing the native card detail interaction or the RSI site header and side rail.

## Search presentation

Place a compact search field in the existing Roadmap header, above the category controls. As the user types, show an anchored dropdown of matching cards. Each result shows the card title, release/patch, category, and status. Show a clear no-results message when nothing matches; while RSI loads the archive, show a short searching state.

## Search and navigation behavior

- When the native board mounts, open RSI's “Show Previous Releases” control and observe its release track for cards rendered later. Re-open it before a search if the user collapsed it. Search all rendered card text plus patch, category, and status; do not make additional network requests.
- Keep the archive observer active until the Roadmap module is disabled or the route changes, so later archive batches update an open query without requiring another keystroke. Keep previous releases open after selecting an archived result so the target remains visible.
- Choosing a result expands its native category, scrolls the release and card into view, and briefly highlights the card.
- Keep the native card link and click behavior intact so the existing detail pop-out continues to work.
- Support keyboard selection, Escape to dismiss, and a clearable search field.
- Match the supplied compact result list: count and “Enter to jump” prompt above card rows, with patch/category details and a status badge; Ctrl+K focuses the search.

## Boundaries

Keep the search scoped to the Roadmap route and its existing module setting. Preserve the site header, Roadmap layout, release/card status colours, and native detail modal. The supplied visual preview is [mockups/roadmap-search.html](../mockups/roadmap-search.html).

## Acceptance checks

- Matching terms surface the expected cards and their patch/category/status.
- Selecting a result expands the correct category and brings that card into view with a visible temporary highlight.
- Empty queries, no matches, keyboard navigation, and dismissing the results are handled.
- Native card activation still opens the existing Roadmap detail modal.

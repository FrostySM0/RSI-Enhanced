# Comm-Link Listing Editorial Redesign

## Scope

Redesign only the Comm-Link listing at `/en/comm-link`. Individual transmission, engineering, video, and other article pages keep their current presentation. This remains an independent RSI styling module and does not add runtime behavior.

## Live page observations

The inspected listing is rendered under `#platform-client-root`. It has a `COMM-LINK` heading, native Channel, Series, Type, Sort, and Search controls, followed by story links to `/comm-link/...`. The first story is presented as an oversized text tile; neighboring entries mix artwork, text, and card sizes. At desktop width the filter row is spread across a narrow content area, leaving unused space and separating search from the other controls.

## Design

- Give the listing a broad, readable editorial canvas that breaks out of a centered site column and uses the full viewport width. Keep the page heading and native controls readable while retaining their labels and behavior.
- Replace the black/cyan grid background with a restrained navy gradient, scoped to the Comm-Link listing route. Clear the existing page-root background so it does not obscure the new canvas, and reduce the excessive gap above the listing.
- Give the page title, native filter form, labels, and “All RSI Communications” link a consistent editorial treatment without changing the native filter layout or behavior.
- Keep the site's native featured story and following-card geometry. Apply a consistent visual treatment to titles, metadata, surfaces, and borders without imposing a guessed grid on the live card hierarchy.
- Keep original color artwork visible and preserve each card's native image sizing, crop, overlay positioning, title sizing, and spacing. Apply restrained colors and borders without changing the card layout.
- Use the existing RSI theme tokens for surfaces, borders, text, muted text, and accent. Keep decorative line work restrained so it does not compete with article artwork or copy.
- Preserve all native story links, filter/sort/search controls, card content, artwork sources, and navigation. Implement with CSS against the live listing structure; do not clone or rewrite page content.

## Out of scope

Article detail pages, new search or filtering features, update markers, data fetching, and changes to the native RSI content are excluded.

## Verification

Use a listing-only fixture based on the observed native story links and controls inside a centered, width-limited parent. Verify that `#channel` breaks out to viewport width, no forced grid or card-level sizing replaces native geometry, artwork crop and overlays remain native, links and controls remain, and detail-page typography stays isolated. Run the targeted Comm-Link check and build; record live browser verification separately.

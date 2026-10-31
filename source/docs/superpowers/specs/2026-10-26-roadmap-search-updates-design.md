# Roadmap Update Markers

## Intent

Keep persistent New/Changed markers on the Roadmap Release View. The extension reads the cards RSI currently renders and compares them with a saved local baseline.

## Behavior

- Mark cards added since the user last cleared updates as **New**. Mark existing cards as **Changed** when their title, status, patch, or description differs from the saved baseline.
- Keep markers until the user selects **Mark all seen**, including if a card later reverts or temporarily disappears. Persist pending marker IDs alongside the baseline.
- Observe live card additions and content changes while Release View is open. Do not poll, contact a server, or call commerce APIs.
- Show a compact update summary and **Mark all seen** control near the Release View heading. If no heading is available, keep the toolbar inside page content and below the site's global navigation.
- Keep the toolbar independently toggleable from Roadmap appearance and the source-image viewer. User-facing setting label: **Roadmap Updates**. Preserve the existing `roadmapTools` storage field for compatibility.
- When disabled or leaving the Roadmap route, remove extension-owned marker UI and disconnect observers while retaining saved history.

## Card identity and comparison

Read native card anchors matching `a[href*="/roadmap/release-view/"]` and their status bar, title, description, and detail route. Prefer a stable numeric card ID when present; otherwise use the normalized path. Extract patch/version text with a general version recognizer. On first use, wait until the rendered collection settles before saving the baseline, so existing cards are not marked new. The clear action stores the current rendered cards as the new baseline and clears pending markers.

## Settings and integration

The extension setting remains an independent boolean with default `true`, so existing installs keep the marker feature enabled. The potentially larger baseline remains in its own `chrome.storage.local` key. Resetting appearance settings must not erase update history. The Roadmap update stylesheet keeps its own route and setting guard and styles only extension-owned update controls and card markers.

## Verification

Use the local native-card fixture to verify baseline initialization, new and changed detection, persistence until clear, live card changes, route/setting cleanup, and settings persistence. No authenticated browser inspection is part of this work.

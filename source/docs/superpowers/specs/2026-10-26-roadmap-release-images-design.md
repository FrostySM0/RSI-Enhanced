# Roadmap Release View images

## Intent

Show Release View card images in colour and let users open the image URL already supplied by each card. Preserve RSI's native cards and add an image viewer.

## Approaches

- **Preserve native cards with an image viewer (selected):** remove grayscale from the observed `figure[media]` thumbnail, open that exact URL in an accessible dialog when the image is activated, and offer one source link there. Keep the card's native release-details link available.
- **Replace the cards:** gives full control over image presentation but risks breaking RSI's React-owned navigation and status controls.
- **Open the image directly in a new tab:** simplest, but offers no integrated close control.

## Goals and constraints

- Add an independently guarded Roadmap module and settings switch for `/roadmap/release-view` only.
- Use the card's `media` attribute as its image source, falling back to its matching `background-image` URL. For RSI media-host URLs ending in `product_thumb_large.<format>`, replace that rendition with `source.<same format>` for the viewer and source link; preserve other URLs.
- Keep card status, title, description and release-details navigation intact. Activating the image opens a dialog; Escape, close button and backdrop close it and return focus.
- Provide one open-source link. Users can save the image from the browser context menu after opening it; do not add a duplicate download button or extension permissions/runtime dependencies.
- Verify route isolation, color styling, source selection and dialog controls with a local fixture and focused tests. No authenticated page or user browser inspection is required; the supplied outerHTML is the observed DOM evidence.

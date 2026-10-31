# Spectrum Message of the Day Card

## Intent

Make the Message of the Day easier to scan in Spectrum General and Testing chats by replacing its bright, crowded strip with a readable full-width card.

## Goals and constraints

- Use the existing dark Spectrum surfaces and cyan accent.
- Improve spacing and hierarchy for the title, timestamp, multiple announcement lines and links.
- Keep the native announcement text, links and dismiss control intact.
- Apply the same lobby-scoped treatment to General and Testing.
- Keep the change CSS-only; do not alter chat scrolling or message rendering.

## Approaches

- **Full-width announcement card (selected):** uses the available chat width, gives the notice a dark surface and cyan accent, and separates its content with spacing. This matches the extension's existing dark theme while preserving the site's layout.
- Restyle the existing strip: least visual change, but retains the crowded banner treatment.
- Narrow centered panel: creates a distinct card, but wastes available desktop width in chat.

## Implementation choices

Style the verified `.lobby-message--motd` wrapper in `src/styles/spectrum-chat.css`, scoped to `#react #page.lobby`. Use existing palette tokens. Keep the wrapper's native display, positioning and controls untouched; use safe semantic descendants for text, links and focus feedback.

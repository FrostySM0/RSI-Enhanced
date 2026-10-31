# Citizen Dossier redesign

> Retired in version 0.11.14 at the user's request. Citizen Dossier routes remain native and outside RSI Enhanced styling; the proposal below is historical.

## Intent

Make the public Citizen Dossier roomier and visually current, using the extension's dark navy surfaces, blue accents and readable typography. Expand the verified `#profile.wrapper` around the dossier to use available desktop width. Preserve the existing profile and organization information, native tabs and edit links from the user-supplied markup.

## Approaches

- **Extend Account & profile (recommended; working assumption):** classify the verified `/citizens/{handle}` and `/citizens/{handle}/organizations` paths under the existing Account & profile module and restyle the native markup in `account.css`. This stays CSS-first and uses the existing module toggle.
- **Add a separate Citizen Dossier module:** gives a separate on/off switch but adds settings, migration and packaging work for the same visual-only change. Not selected unless the user asks for independent control.

## Goals and constraints

- Use available desktop width and organize the profile, main organization, bio, enlistment and language into clear, consistent surfaces.
- Keep the Overview and Organizations links, profile picture, rank, text, edit links and all native behavior intact.
- Preserve RSI's privacy and redaction masks, including `.member-visibility-restriction`, `.visibility-R` and the `.data*` obfuscation elements.
- Limit route handling to the overview and organizations paths observed in the supplied links; do not change public Spectrum identities or organization pages.
- No DOM transformation, action interception, added permissions or mobile-specific behavior. The current account module's setting controls this styling.

## Implementation and verification

Use CSS scoped to `#public-profile.account-profile` inside the existing Account stylesheet/module guard. Add the supplied redacted structure as a local fixture. Verify the exact route variants and nearby excluded paths, preservation of native controls and privacy masks, packaged CSS guard, and production build. Live authenticated visual validation remains for the user.

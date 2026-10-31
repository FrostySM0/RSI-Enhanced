# Spectrum Chat Implementation Plan

**Goal:** Desktop chat styling matching the approved forum/reference direction.
**Architecture:** Append `src/styles/spectrum-chat.css` to the existing Spectrum bundle. Scope messages/composer to verified `#react #page.lobby`; scope external channel/member panels using `#react:has(#page.lobby)`. Preserve website scrolling, virtualized presence dimensions, grouping and actions.

- [x] Inspect live public chat DOM and source rules for grouped messages, mentions, media, channels and composer/error contracts.
- [x] Add a focused fixture covering grouped timestamps, mentions, media overflow, selected channels, error state and late messages; observe the missing styling before implementation.
- [x] Implement readable flat messages, round 48px avatars (36px compact), matching channel/header/presence colours, code/media containment and safe composer palette rules. No storage, runtime JS or new permissions.
- [x] Build; run only the packaged-Spectrum CSS check and relevant desktop fixture checks. Update version, guidance and inspection limits. No forum rework or mobile testing.

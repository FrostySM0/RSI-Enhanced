# Spectrum Forums Implementation Plan

**Goal:** Phase 3 forum readability and layout improvements, without changing site interactions.
**Architecture:** Add `src/styles/spectrum-forums.css` after the existing foundation in the Spectrum bundle. Use verified forum roots and CSS variables; prepare density/avatar attributes for Phase 5, without adding settings or storage now.
**Constraints:** No new dependencies, DOM observers, polling, chat redesign or unrelated RSI styles. Keep the site's subgrid, collapse controls, nested replies, role colours and disabled states.

- [x] Inspect live list, discussion, replies, quote/image markup and existing CSS rules for unread, code and embed contracts.
- [x] Create a focused forum fixture; observe missing width/card/media styles before implementation.
- [x] Implement a 1200px reading-width cap, balanced spacing with compact/comfortable variants, consistent avatar corners, reply cards, quotes, scrolling code, constrained media and existing unread-state emphasis.
- [x] Build and check only Spectrum packaging, then inspect desktop/mobile fixture layout, density/width/avatar variants, late content and preserved controls.
- [x] Update version to 0.3.0, popup status, architecture and selector documentation. Report the live extension validation limit.

**Review focus:** preserve subgrid columns; avoid styling all `.unread` elements as unread; constrain oversized media/code without clipping controls; preserve nested reply hierarchy; keep forum CSS out of chat and other RSI sections.

**Superseded choices:** User feedback after Phase 3 requires full-width desktop forums rather than a 1200px centred column. Version 0.3.1 removes that default cap and mobile-specific overrides, makes avatars circular, and applies consistent sans-serif typography directly to the verified forum components. See `docs/spectrum-inspection.md` for the desktop regression check.

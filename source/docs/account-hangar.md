# Account and My Hangar — personal-use build 0.6.2

## Evidence and approach

The user requested these modules without accessing their browser. No browser session or credentials were used. Public HTTP reads of RSI’s current account page and its linked assets supplied the selector evidence:

- https://robertsspaceindustries.com/en/account/pledges — signed-out Restricted Area, links the current account CSS/JS assets.
- https://robertsspaceindustries.com/cache/en/rsi-css.css?v=9.592.0 — verified #settings .inner-content, .row, .shadow, .inner, labels, .col-edit-wrapper > .view, .more-info, heading and focusable components; verified #billing.pledges .inner-content, .content .row, .row.dark/.active, .list-items .title-col, h3, .items-col, custom-name/nameable-infobox, .hangar-info and pager contracts.
- https://static.robertsspaceindustries.com/rsi/static/packages/account/rsi.account.build.bc2e4.js — verified native row expansion and pledge gift/reclaim/upgrade/rename handlers. Extension code never invokes or changes these handlers.

Use the established palette and route/module @scope guards. The Hangar redesign replaces the abrupt inner-column fill with a unified shell and transparent content column, a rounded header, calmer side navigation and rounded item cards with consistent padding. The decorative header separator is hidden. Native pledge expansion and controls remain site-owned; cards are not clipped with overflow rules. Account settings retain conservative geometry. Availability, warning/entitlement-lock colours and item artwork retain their site rules. No remote assets or new dependencies are shipped.

## Settings and routes

Independent Account & profile and My Hangar switches default on when migrating existing settings. Account settings routes include /account, /account/settings, and /account/profile (optional locale/trailing slash). Settings styling requires the existing #settings component. The public Citizen Dossier routes remain native and are excluded from extension styling. Other account paths receive no guessed rules. My Hangar route: /account/pledges only, requiring #billing.pledges. Nested financial/security/action routes are excluded.


## Verification and limits

Production build, settings-scoped TypeScript and 12 targeted Account/Hangar, route/packaging, runtime and storage tests passed. Tests cover locale/boundary exclusions, independent migration/toggles, route updates and packaged guards. No other feature suites or browser automation were run. Signed-in appearance and interactions were not visually verified. Reload the unpacked extension and refresh the Account/My Hangar page to evaluate in the user’s preferred Chromium desktop browser.

This is a personal-use extension, not a public-release project. Public-store publishing checks are not required for this work.

## Hangar redesign verification — 0.6.2

The user screenshot exposed a hard rectangular inner-content background beside the patterned sidebar. Move the background to the Hangar shell/body (strictly inside its existing route/module guard), leave inner-content transparent, and use 22px shell / 16px header / 14px card corners. Desktop header and card padding is 24px. Sidebar special/disabled states and pledge availability/entitlement colours retain native rules.

Verified the isolated localhost sample at 1280px: transparent inner column, rounded header/cards, no horizontal overflow, expanded pledge action area visible, late-loaded cards styled, module-off restoration of the original body background and decorative separator. Three Account/Hangar-focused tests passed. Sample includes real competing RSI CSS contracts; synthetic artwork/controls are not live account interaction tests. No user browser/session accessed.

## Control repair — 0.6.3

User confirmed expansion/filter failures remain with My Hangar styling disabled. Public account JS verifies showBillingRow toggles the closest .row active state and onProductTypeFilterChange navigates to the selected value. Public core JS verifies custom option labels come from li text, URLs from li[rel], selected state from li.selected, and the selected value is written to an input.

A Hangar-only helper now observes the arrow state in window capture, lets native document handlers run, then supplies the missing toggle in window bubbling only if the state stayed unchanged. It prevents the expand link’s default navigation, supports existing late-loaded cards and never calls pledge action APIs. If site handlers stop event propagation before window bubbling, this fallback cannot run.

On DOM ready and settings/route updates, replace only the verified product-type .js-selectlist widget with a native select populated from existing valid li[rel] options. Preserve matching URL selection; allow only same-origin Hangar destinations and skip empty/unchanged URLs. The original widget is restored when the module is disabled. No guessed filter values, page polling, observers or script injection. A filter inserted asynchronously after these hooks still requires another settings/route refresh; no generalized observer is added.

Layout: stack title/entitlement badge, prevent title flex growth, reserve arrow space and give the existing .js-expand-arrow a 36px target. The earlier simplified fixture omitted the entitlement title row and used fake expansion controls; it did not establish production control compatibility. The updated fixture includes those contracts, deliberately missing native handlers, an optional native handler, and custom-filter li[rel] markup.

Verification: production build, settings-scoped TypeScript and six focused control/Account/Hangar/runtime tests passed. Isolated browser checks confirmed fallback expansion/collapse, native-handler coexistence, filtered URL navigation with selected state after reload, invalid-option exclusion and original-widget restoration when disabled. The long-title lock card measured about 227px high with a 12px title-to-badge gap and no horizontal overflow at 1280px. Signed-in page remains uninspected; no user browser or credentials accessed.

## Reference-format correction — 0.6.4

The user supplied the native horizontal format: thumbnail left; title/upgrade/entitlement across the top; status and creation/contents below. Remove the forced column direction from 0.6.3. Keep title and entitlement badge in one flex row, allowing title text to wrap within its own remaining space. Keep the native thumbnail float and verified wrapper-col margin of 140px; use a flow-root wrapper and reset the nested col.title-col float/width/left padding with enough specificity to defeat the native row/col rule. Otherwise the wrapper’s margin plus column padding creates a double 140px indent. Reset inherited item-col heading top padding too. Keep the expand target below the header, in the right-side details area.

Updated fixture now includes wrapper-col and col.title-col, the real competing full-width/left-padding column rule, and native heading padding. Local 1280px measurements: titles start 10px below thumbnail tops with a 40px thumbnail-to-text gap (100px synthetic thumbnail inside the 140px reserved column); card heights approximately 157px and 181px, with title and entitlement beside each other. No horizontal overflow. Repositioned arrow click expands existing details. Build and the targeted Account/Hangar packaging guard check passed. No signed-in inspection or user-browser access.

## Confirmed upgraded-card fix and image card — 0.6.5

The user supplied the affected package’s outerHTML. This established the actual basic-infos / item-image-wrapper / wrapper-col / title-col structure (title-col has no col class) and, crucially, the icon-only shadow-button.upgrade inside h3. No private pledge IDs or values were copied into the fixture. Earlier simplified samples omitted this heading child, so their visual checks did not establish this upgraded package’s layout.

Reproduced the failure with the supplied structure and native button width of 3px. The heading’s overflow-wrap:break-word propagated into the transparent Upgrades label, producing eight wrapped text fragments. Baseline heading height was about 252px, card about 374px. Setting white-space:nowrap / overflow-wrap:normal on the native upgrade button, with vertical alignment and no vertical button margin, reduced the heading to 32px and the card to 156px without removing or relocating the native action. Preserve this real heading child and competing button rules in future regression fixtures.

Image card implementation lives in src/content/hangar-image.ts. Delegated Hangar-only clicks resolve img currentSrc/src or the verified .image computed background URL; use exactly that existing HTTP(S) source, without guessing an original-size URL. Native dialog provides top-layer focus handling and Escape; Close/backdrop remove it and restore thumbnail focus. Existing thumbnails gain a reversible button role, label and keyboard access. No remote asset dependencies, image uploads, observers or polling; only the requested image source is loaded when opened. Disabling My Hangar closes the dialog and restores changed thumbnail attributes.

Verification: production build, scoped TypeScript and seven feature/affected-runtime tests passed. Isolated browser reproduced before/after measurements above, opened and loaded a 1000px synthetic source image from its actual DOM URL, verified title extraction excludes the Upgrades button label, Close/focus return, keyboard reopen and Escape dismissal. This uses a local source image and the supplied sanitized markup, not the user’s signed-in browser.

## Full-size preview — 0.6.6

Verified public HTTP responses for the user-provided Aurora asset: /media/hyofyr9qja82wr/heap_infobox/WD_3119_V02_Aurora_Turbu.jpg is 165x165 (11,419 bytes), while the matching /source/ rendition is 2420x1606 (949,225 bytes), both HTTP 200 JPEG. Upgrade only this verified RSI-host /media/id/heap_infobox/file path pattern. Other hosts/renditions retain their existing URLs. The popup and source link now prefer the larger image; a failed source load retries the original thumbnail once and reports the fallback. No artificial image enlargement or unrelated URL rewriting.

Build, settings-scoped TypeScript, two image tests and affected content runtime test passed. Actual source dimensions verified from JPEG frame headers. The unchanged dialog UI was not retested in a browser during this small resolver change; fallback event handling was inspected, not separately browser-exercised.

## All Hangar content images — 0.6.7

Preview delegation and keyboard decoration now include main package thumbnails, expanded .items .with-images .item .image elements and the verified hangar-info-image img component. Direct img elements use their own currentSrc/src. Expanded items use their own .text .title caption rather than the enclosing pledge title. There is no package-name or page-number condition.

Full-size resolution is generic by host/path pattern for every asset ID: RSI /media/id/heap_infobox/file -> /media/id/source/file; media.robertsspaceindustries.com/id/subscribers_vault_thumbnail.jpg -> /id/source.jpg. Verified the supplied Constellation media asset: 216x133 thumbnail versus 3840x1646 source.jpg (both HTTP 200 JPEG). Preserve unknown source paths and keep the one-time thumbnail fallback if a larger rendition is unavailable.

Production build, scoped TypeScript and four image/runtime tests passed. Isolated browser check expanded the actual-structure sample package, clicked its nested image and confirmed a loaded image dialog with the individual Constellation title. No user browser/session accessed.

## Media-host heap images — 0.6.8

The user screenshot exposed an additional URL format: media.robertsspaceindustries.com/61m3eb9bir225/heap_infobox.jpg. Verified public JPEG dimensions: thumbnail 165x165; corresponding source.jpg 3840x1646, both HTTP 200. The generic media-host resolver now accepts both heap_infobox.jpg and subscribers_vault_thumbnail.jpg for any asset ID, preserving query parameters. Existing popup and source-link full-size/fallback behaviour is unchanged. Production build, scoped TypeScript and five focused image/runtime tests passed, including the exact reported format plus multiple other IDs and external-host isolation. No browser access needed for this resolver-only change.

## Workspace redesign — 0.7.0

Current architecture and verification scope: see hangar-workspace.md. This supersedes earlier shell/rounded-header presentation while preserving confirmed upgraded-package and image-preview fixes.

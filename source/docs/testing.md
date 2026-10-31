# RSI Enhanced testing guide

## Automated checks

Run `pnpm test` for the complete regression suite. It first builds `dist/`, then uses Node's built-in test runner to discover every `tests/*.test.mjs` file, including route and state checks that use only local fixtures. This works from a clean checkout after dependencies are installed.

Run `pnpm verify` for the full package check. It runs `pnpm test` (build plus the complete test suite), then runs `scripts/check-release.mjs` to validate the generated Manifest V3 package, permissions, local assets, classic script entries, and runtime constraints.

Focused commands remain available:

- `pnpm check:scaffold` for the extension skeleton and package contract.
- `pnpm check:theme` for Spectrum stylesheet packaging, route isolation, and palette contrast.
- `pnpm check:settings` for validated settings, storage, popup runtime, and reply context behavior.
- `pnpm check:release` for the already-built package only; run `pnpm build` first when source files have changed.

Feature coverage is organized by these test files:

| Area | Focused coverage |
| --- | --- |
| Settings, popup, and extension scaffold | `scaffold.test.mjs`, `settings*.test.mjs`, `popup-*.test.mjs` |
| Spectrum theme, home, forums, replies, and sidebar | `spectrum-theme.test.mjs`, `spectrum-home.test.mjs`, `spectrum-forum-list.test.mjs`, `spectrum-conversation.test.mjs`, `spectrum-reply-context.test.mjs`, `spectrum-saved-threads.test.mjs`, `spectrum-sidebar-*.test.mjs` |
| Spectrum chat, messages, notifications, and blocks | `spectrum-chat-groups.test.mjs`, `spectrum-messages*.test.mjs`, `spectrum-notifications.test.mjs`, `spectrum-blocks*.test.mjs` |
| Hangar and account | `account-hangar.test.mjs`, `hangar-*.test.mjs` |
| Roadmap | `roadmap-*.test.mjs` and Roadmap contracts in `rsi-sections.test.mjs` |
| Public RSI pages | `organizations-*.test.mjs`, `commlink-*.test.mjs`, `funding-*.test.mjs`, `patch-notes.test.mjs`, `devtracker-context.test.mjs`, and route contracts in `rsi-sections.test.mjs` |

The Messages preview-route integration test binds only to `127.0.0.1` on an ephemeral port. Tests do not request RSI or another external service and do not need a signed-in browser session.

## Chrome fixture review

After `pnpm build`, start the local fixture server with:

```text
node tests/preview-theme.mjs
```

Open `http://127.0.0.1:4173` in desktop Chrome. Review the relevant routes at desktop widths (1280px or wider):

| Route | Review |
| --- | --- |
| `/spectrum/community/SC` | Bookmark icons, unread markers, sidebar labels, home header, and native links |
| `/spectrum/community/SC/forum/3` | Forum list rows, unread markers, counters, and native controls |
| `/comment-layouts` | Nested threaded replies, spacing, author rails, and reply-card surfaces |
| `/spectrum/community/SC/forum/3/thread/mock-thread/4` | Parent context labels, safe text rendering, and linked reply behavior |
| `/spectrum/community/SC/lobby/1` and `/chat?density=compact` | Chat header, grouped messages, media, status, and compact density |
| `/spectrum/messages-preview` | Messages header, New action contrast, populated row, conversation count, unread count, and signal bar |
| `/spectrum/messages-empty-preview` | Messages empty state, title/body readability, and native New action |
| `/roadmap/release-view` | Release View icon/header, card description readability, and native card detail |
| `/en/patch-notes` | Patch Notes title icon and article readability |
| `/en/account/pledges` | Hangar card layout, controls, expanded cards, and search placement |
| `/src/popup/index.html` | Settings controls, previews, and saved appearance choices |

Funding Goals, Organizations, and Comm-Link have focused automated coverage, but the local public-page fixture is only a shared component sample and does not reproduce their full native page structures. It is not valid visual confirmation for those modules. A native-shaped Funding Goals fixture remains a known coverage gap.

Stop the server with Ctrl+C after review. This is a manual rendering pass, separate from `pnpm test`; it checks representative fixture states, not every setting combination.

## Limits

Fixtures preserve observed RSI markup and exercise local CSS/runtime behavior. They do not validate the current live RSI DOM, authenticated actions, account data, or live network APIs. There are no cross-machine screenshot baselines, so font rasterization and minor browser rendering differences are assessed visually in Chrome.

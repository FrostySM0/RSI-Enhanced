# Hangar Log redesign

## Intent

Make pledge history easier to scan and visually consistent with the redesigned Hangar, while preserving RSI's native log content and behavior.

## Approaches

- **Activity timeline (selected):** restyle each existing `.pledge-log-entry` as a compact dark activity card, emphasize its linked pledge name, and make the date/action text easier to read. This preserves the current data and native scroll implementation.
- **Group entries by date:** reorganize records into date sections. This needs DOM transformation and risks disrupting RSI's custom scrollbar and dynamically loaded history.
- **Restyle current rows only:** change the existing colors and type without creating clearer entry separation. This is lower risk but does less to improve scanning.

## Goals and constraints

- Scope presentation to `.modal-inner:has(> #pledge-log)` and the supplied `.pledge-log-*` structure.
- Retain the close link, heading icon anchor, loading state, all entry text and links, and the native `.scrollable` / `.viewport` behavior.
- Use the existing Hangar dark surfaces, cyan accents and readable typography; keep the current content order.
- Make no Hangar Log data, navigation, or action changes. Leave the Ship Upgrade panel visually native; its controls are covered by the separate action-button repair.

## Verification

Implementation: approved activity timeline using only the supplied selectors. The existing Log rows now use dark cards, a cyan timeline rail and markers, cyan pledge-name emphasis, and clearer supporting text.

Verification uses a focused synthetic fixture/CSS regression check, the targeted Hangar action checks and a production build. Live signed-in interaction remains user-verified.

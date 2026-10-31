# Roadmap Update Tracking Removal

## Intent

Remove the New/Changed release tracker because its status panel and controls obstruct the Release View. Keep the native release cards, source-image viewer, and full-colour card artwork.

## Goals and constraints

- Remove update summaries, New/Changed badges, the clear/retry controls, the Roadmap Updates setting, and the tracker’s storage/runtime code.
- Keep `rsi.roadmap` as the independent image-viewer setting; keep the Roadmap image viewer and colour-restoration CSS packaged.
- Do not clear the old `rsiEnhanced.roadmapUpdates` storage entry; the retired code will no longer read or write it.

## Approaches

- Remove only the panel and leave hidden tracking active: rejected because the user asked to remove all update controls and keep only image features.
- Retire the tracker, setting, and its styling while preserving the image module: selected by the user; this avoids dead observers and storage writes.
- Replace the panel with a smaller summary: rejected because update controls are no longer wanted.

## Design decision

The user confirmed: “remove all update controls just keep the image stuff and the image colour features.” Remove the tracker end-to-end and retain the separate image viewer and colour styling.

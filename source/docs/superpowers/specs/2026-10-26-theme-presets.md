# Default Theme Presets

## Intent

Give users more ready-made visual choices in RSI Enhanced without requiring them to build a custom palette. The theme picker should contain manufacturer-inspired and atmosphere-inspired presets, and the Custom theme editor should be removed.

## Goals

- Keep the seven existing built-in themes.
- Add Drake, Crusader, RSI, Nebula, Aurora, and Eclipse presets.
- Apply every preset through the existing palette system to Spectrum and enabled RSI sections.
- Remove the Custom theme choice and custom palette editor from settings.
- Keep the separate accent-colour override.
- Normalize a previously saved `custom` theme to Spectrum Enhanced while preserving valid accent and other saved settings.
- Maintain readable text and accents across the four palette surfaces checked by the settings tests.

## Non-goals

- No changes to page modules, their switches, theme effects, or site layout.
- No new theme preview artwork or external dependencies.
- No settings version migration beyond normalizing the old `custom` theme value.

## Approaches

- Add six manufacturer and atmosphere presets and remove Custom. **Selected.** This gives users a broader ready-made set while keeping one shared palette implementation.
- Add only three presets. This is smaller, but does not provide the variety requested.
- Keep Custom alongside new presets. This preserves palette editing but conflicts with the request to remove Custom.

## Palette direction

- Drake: graphite with copper accents.
- Crusader: deep blue with sky-blue accents.
- RSI: slate with red accents.
- Nebula: indigo with violet accents.
- Aurora: blue-green with mint accents.
- Eclipse: charcoal with amber accents.

The exact token values are an implementation choice constrained by the existing 4.5:1 settings contrast check.

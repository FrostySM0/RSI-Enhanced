# Spectrum palette additions

Add three selectable built-in Spectrum themes from the approved palette preview: Xi’an Jade, Pyro Ember, and Terra Frontier. Keep all existing presets and stored settings compatible. The theme dropdown is populated from `THEME_NAMES`, so new names and palette entries should be added to the current registry rather than introducing another selector path.

Each palette supplies the current background, surface, raised, hover, text, muted, accent, and border tokens. Add one `highlight` token for the preview’s secondary warm color. Existing presets keep the current developer-thread marker color (`#bfa739`) through that token; the three new palettes use their own warm highlight. A user’s custom accent override affects only the accent token.

| Theme | Background | Surface | Raised | Hover | Text | Muted | Accent | Highlight | Border |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Xi’an Jade | `#0b1118` | `#121b23` | `#1a2930` | `#263b3b` | `#e7f0ee` | `#aabbb7` | `#43d6b0` | `#d5b879` | `#34474c` |
| Pyro Ember | `#100e0c` | `#191614` | `#25201c` | `#352a22` | `#f3e9de` | `#b9aaa0` | `#f28a55` | `#f1bb73` | `#514038` |
| Terra Frontier | `#131712` | `#1b211b` | `#293127` | `#394635` | `#eceee3` | `#b6beaa` | `#a9c66f` | `#d8bd8b` | `#46513f` |

Keep home banner, Forum and Chat Lobbies artwork, and sidebar appearance unchanged. Do not add permissions or change the storage schema. Verify registry values, palette contrast, root token application, popup option population, and packaged theme behavior. Bump the extension version and create a matching tester folder and ZIP without replacing earlier releases.

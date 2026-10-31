# Dev Tracker reply context

## Goal

Show the exact Spectrum post that each Dev Tracker entry replies to, including the parent author's display name, avatar and message text, so readers can understand a developer response without opening the thread first.

## Approved presentation

Keep the existing Dev Tracker card, author rail, category and thread title. Rename the page heading to “Star Citizen Dev Tracker.” In the content column, show the parent's avatar, name and actual post text followed by the developer answer inside one shared, theme-aware panel. Place the parent user reply in a neutral inset panel with equal spacing on all four sides so it reads separately from the developer response; keep the developer response aligned to the shared panel's normal content edge. Separate the two messages with a simple divider and clear labels, without adding a second box around the developer response. Use the active extension font throughout. Show a 320-character preview only when a message is longer, followed by a Show more button that expands the message inline and changes to Show less. Each message has its own control. For the developer answer, use the full linked Spectrum reply text as the expansion content and preserve the native Dev Tracker excerpt as its collapsed preview when RSI truncates it. Apply the selected Developer post text colour to both the excerpt and expanded developer reply. Keep button clicks from triggering the card's native thread link.

### Expansion approach

Use the same inline disclosure for both messages. For the parent, swap the preview text for the complete text when expanded. For the developer reply, keep the original native content hidden in place and show a plain-text preview and complete reply text from Spectrum's read-only reply endpoint; this ensures an ellipsized Dev Tracker excerpt can expand to the actual full response.

## Data and behavior

- Resolve the target reply ID from each native Dev Tracker thread/reply URL.
- Read the target reply and its immediate parent through RSI Spectrum's same-origin read-only API; use the original thread post when the target replies directly to the original.
- Verify reply IDs and thread IDs before rendering. Never infer parent text from the topic title or developer excerpt.
- Render text with DOM text nodes, and accept only safe HTTP(S) avatar URLs. Use the existing Spectrum author fallback when author/avatar data is missing.
- If parent context cannot be retrieved, show a clear unavailable state instead of fabricated content.
- Preserve the native post anchor and Auto Load controls. Handle cards added by native Auto Load and stop work when the route/module is disabled.
- Dev Tracker links target the exact developer reply and include a reply intent flag. On that Spectrum single-reply page, use the native Reply button inside that exact reply to open its normal composer; do not send or prefill a message. If the native control is unavailable, tell the user to use it manually.

## Scope

Dev Tracker only. No new permissions, dependencies, background worker, API mutations, or browser-session inspection.

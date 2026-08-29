# Play Store assets and authentic screenshot plan

Committed assets:

- `play-icon-512.png`: 512 × 512 high-resolution Play icon.
- `feature-graphic-1024x500.png`: 1024 × 500, opaque 24-bit PNG.
- `feature-graphic-1024x500.svg`: editable source for the feature graphic.

## Phone screenshots

Do not fabricate app screens. Capture the signed Phase 24/25 candidate with a
dedicated test account, realistic non-sensitive test conversations, no private
email addresses, no notification tokens, and no developer overlays.

Save at least two portrait PNG or JPEG screenshots in
`release/play-store/screenshots/`. Recommended set at 1080 × 1920:

1. `01-chats.png` — Chats list with direct and group rows.
2. `02-direct-chat.png` — direct text, photo, reaction and receipt states.
3. `03-group-chat.png` — small-group conversation.
4. `04-search.png` — People/Chats/Messages search.
5. `05-privacy.png` — privacy and blocking controls.
6. `06-settings.png` — appearance and notification controls.

Use the same light/dark theme consistently across the set. Store screenshots
must depict the actual build and must not imply calls, secret-chat E2EE, audio,
video, files, stories, bots, channels, iOS support, or any other post-V1 feature.

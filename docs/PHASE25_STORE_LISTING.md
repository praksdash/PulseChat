# Phase 25 Play Store listing

Default language: English (United States)  
Category: Communication  
App name: PulseChat

The canonical copy is `release/play-store/listing/en-US.json`; the automated
audit enforces Play character limits.

## Positioning rule

Describe only shipped Prototype V1 behavior: direct/small-group text and image
messaging, message actions, receipts, search, notifications, privacy/settings
and offline text recovery.

Never claim calls, secret chats, E2EE, audio/video/file sending, stories, bots,
channels, desktop/iOS production support, proactive moderation, guaranteed
delivery, anonymity or Telegram-scale behavior.

## Required console fields

- App name, short description and full description from the canonical JSON.
- App category: Communication.
- Support email and support/privacy/deletion URLs from the owner inputs.
- High-resolution icon and feature graphic from `release/play-store/assets`.
- At least two authentic phone screenshots captured from the exact candidate.
- Internal-beta release notes from the canonical JSON.
- App access instructions and a dedicated reviewer account stored outside the
  repository. Never commit reviewer credentials.

## Screenshot captions (optional)

1. Keep every conversation in one place.
2. Message with photos, replies and reactions.
3. Bring people together in small groups.
4. Find people, chats and messages quickly.
5. Control privacy, blocking and notifications.

Captions must not cover UI or imply functionality absent from the screenshot.

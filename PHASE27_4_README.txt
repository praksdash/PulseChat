PulseChat Phase 27.4 — Android LiveKit SDK and permissions
=========================================================

Outcome
-------
Adds the pinned LiveKit native SDK/Expo plugins, minimal Android call
permissions, Web-safe runtime isolation, WebRTC global registration, explicit
permission helpers, and bounded communication-audio start/stop helpers.

No call button or call connection exists yet.

Install and verify
------------------
After extracting this package:
  npm ci
  npm run qa:phase27-4

Expected focused result:
  50 tests, 50 passed, 0 failed

Required new APK
----------------
The old APK and Expo Go do not contain LiveKit native modules. Build a new
preview APK:
  npm run build:android:preview

Install that new APK on one Android phone. Confirm:
1. PulseChat opens without a native-module crash.
2. No microphone, camera, or Bluetooth permission prompt appears at startup.
3. Login, Chats, Search, Privacy, text/image messaging, and push still work.

There is intentionally no visible call button in Phase 27.4.

Security
--------
- Never add LiveKit API key/secret to the app or EAS client environment.
- Screen sharing is disabled.
- SYSTEM_ALERT_WINDOW and media-projection service permissions are blocked.
- Do not run npm audit fix --force.

Recommended commit
------------------
feat(calls): integrate Phase 27.4 Android LiveKit runtime


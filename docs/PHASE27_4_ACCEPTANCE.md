# PulseChat Phase 27.4 — Android calling SDK/permissions acceptance

Status: **SOURCE COMPLETE — NEW NATIVE APK SMOKE TEST REQUIRED**

## Objective

Integrate the pinned LiveKit React Native native stack, Expo configuration
plugins, Android media permissions, Web-safe adapter, and bounded communication
audio-session lifecycle without adding any call flow or UI.

## Files changed

- `package.json`
- `package-lock.json`
- `app.json`
- `src/app/_layout.tsx`
- `src/types/call-media.ts`
- `src/services/call-media-runtime.ts`
- `src/services/call-media-runtime.native.ts`
- `scripts/phase27-4-call-native-audit.mjs`
- `scripts/phase24-native-smoke.mjs`
- `scripts/phase24-expo-export.mjs`
- `tests/phase27-4-call-native.test.mjs`
- `tests/phase27-2-call-schema.test.mjs`
- `tests/phase24-release-audit.test.mjs`
- `tests/phase25-play-readiness.test.mjs`
- `docs/PHASE27_4_ACCEPTANCE.md`
- `docs/ROADMAP.md`
- `PHASE27_4_README.txt`

No Supabase schema/function, LiveKit secret, call token, call route, call
button, outgoing/incoming state, or message behavior is changed.

## Pinned native dependencies

- `@livekit/react-native` 2.12.0
- `@livekit/react-native-webrtc` 144.1.2
- `livekit-client` 2.22.1
- `@livekit/react-native-expo-plugin` 1.0.2
- `@config-plugins/react-native-webrtc` 15.0.2

The npm-10-compatible nested EAS TypeScript 5.9.3 peer entry is retained after
the native dependency lockfile update.

## Android configuration

- Communication audio mode is selected.
- Screen-share service is explicitly disabled.
- Camera, microphone, audio settings, Android 12+ Bluetooth connection, and
  notification permissions are declared.
- Unused overlay and media-projection foreground-service permissions are
  explicitly blocked.
- Web/static rendering uses a no-op adapter and never imports native WebRTC.
- WebRTC globals are initialized during native app bootstrap.
- Permission prompts are not shown during app startup.
- The future call action will request microphone, camera only for video, and
  Android 12+ Bluetooth access. Bluetooth denial does not block phone audio.
- The communication audio session has idempotent start/stop boundaries.

## Acceptance criteria

- [x] dependencies and lockfile are exact and reproducible;
- [x] Expo plugins use communication audio and disable screen sharing;
- [x] minimal Android calling permissions are configured;
- [x] unused sensitive overlay/media-projection permissions are blocked;
- [x] native runtime registers WebRTC globals;
- [x] permission requests remain action-driven;
- [x] Web export remains native-module free;
- [x] TypeScript, ESLint, 50/50 unit tests, secret scan, security audit,
  generated native prebuild, Android export, and Web export pass;
- [ ] a new EAS preview APK is built from this exact revision;
- [ ] the new APK installs and opens on a physical Android phone;
- [ ] existing login, Chats, Search, Privacy, and message/push smoke tests pass;
- [ ] opening the app does not prompt for microphone/camera/Bluetooth; and
- [ ] the owner approves Phase 27.4 before Phase 27.5 begins.

## Important build boundary

Expo Go and the old Phase 26 APK do not contain the new LiveKit native modules.
They cannot validate Phase 27.4. Build and install a new preview APK before
running Metro against this source.

The dependency audit reports the existing Expo CLI/config `uuid` advisory as
12 moderate dependency paths and no high/critical production finding. Its
forced fix proposes incompatible Expo package changes and must not be run.

## Explicitly not delivered

There is still no call button, call session creation, LiveKit room connection,
incoming ring, answer/decline control, active call screen, or video view.


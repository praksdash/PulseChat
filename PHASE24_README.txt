PULSECHAT PHASE 24 — ANDROID RELEASE ENGINEERING
=================================================

Status
------
Release source candidate complete. A signed EAS build and physical-device
acceptance are still required before Phase 24 may be marked accepted.

Prototype V1 boundary
---------------------
Phase 24 packages the existing Prototype V1 feature set for Android. It does
not add calls, secret-chat E2EE, stories, bots, channels, desktop sync, or new
media types.

Release identity
----------------
- Android application ID: com.prakashdash.pulsechat
- Marketing version: 1.0.0
- Android versionCode: 24
- EAS CLI: 22.0.0 (locked locally and in eas.json)
- Development build: internal APK with Expo development client
- Preview build: internal signed APK and Phase 24 device-QA candidate
- Production build: Play-compatible signed Android App Bundle
- Version source: committed local values; production auto-increment is off

What changed
------------
- Replaced generic Expo art with reviewed PulseChat launcher, adaptive,
  monochrome, splash, notification, and Web icon assets.
- Locked the application identity and release asset hashes in
  release/android-release-baseline.json.
- Added fail-closed Firebase resolution for EAS file variables while retaining
  the ignored local google-services.json development path.
- Added explicit development, preview, and production EAS profiles backed by
  remote signing credentials.
- Added source/configured release audits, native Android prebuild smoke tests,
  Android/Web export checks, and one complete Phase 24 QA command.
- Added an owner release runbook and signed acceptance record.
- Corrected Windows Metro cipher resolution by bundling the audited AES-GCM
  runtime into a hash-locked local source file with its MIT license.
- Added a forward-only Supabase migration fixing the Phase 21 private
  rate-limiter `actor_user_id` ON CONFLICT ambiguity exposed by queued sends.

Private inputs
--------------
Never put private values into source control, a package ZIP, screenshots, or a
chat message. Configure all three EAS environments with:

- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- GOOGLE_SERVICES_JSON (type=file; upload google-services.json)

FCM V1 service-account credentials are separate Android push credentials and
must be configured through EAS credentials. They are not the Firebase client
google-services.json file.

Clean-source verification
-------------------------

  npm ci
  npm run qa:phase24

Configured release gate
-----------------------
After restoring the private .env and google-services.json locally:

  npm run release:gate:configured

Backend hotfix
--------------
Apply and verify before retrying messages:

  supabase/migrations/202608290018_phase24_rate_limit_ambiguity_fix.sql
  supabase/phase24_verify.sql

Signed preview candidate
------------------------

  ./node_modules/.bin/eas login
  npm run build:android:preview

Follow docs/PHASE24_RELEASE_RUNBOOK.md. Install the resulting APK cleanly and
as an upgrade on the two Android test phones, then complete and sign
docs/PHASE24_ACCEPTANCE.md.

Acceptance rule
---------------
An export or native prebuild is not an installable signed build. Phase 24 is
accepted only when the preview APK is produced from a clean package, its build
ID/URL/SHA-256 and signing evidence are recorded, and every required two-phone
row in the Phase 24 acceptance record passes.

Recommended commit message
--------------------------
build(android): prepare Phase 24 release candidate

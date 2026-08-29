# Phase 24 Android release runbook

This runbook creates the signed Android Prototype V1 release candidate without
committing private configuration or signing material. Run commands from the
PulseChat project root.

## 1. Establish the clean source

1. Extract or clone the Phase 24 package into a new directory.
2. Confirm `.env`, `google-services.json`, keystores, service-account files,
   `.expo`, native output, and prior build output are absent.
3. Install exactly the locked dependency graph and run the source gate:

   ```bash
   npm ci
   npm run qa:phase24
   ```

4. Require all TypeScript, ESLint, unit, secret, dependency, source-preflight,
   accessibility, release-identity, native-prebuild, Android-export, and
   Web-export checks to pass.

The release audit must identify `com.prakashdash.pulsechat`, version `1.0.0`,
versionCode `24`, and EAS CLI `22.0.0`. Source-only warnings about the omitted
private Supabase/Firebase inputs are expected in a clean package; failures are
not.

## 2. Verify the owner backend

Before building, apply all migrations through
`202608290018_phase24_rate_limit_ambiguity_fix.sql`. Run both
`supabase/phase21_verify.sql` and `supabase/phase24_verify.sql`, then redeploy
`send-message-push` plus `delete-account`. Confirm the Phase 15 Database Webhook
and existing Supabase function secrets remain configured.

## 3. Configure EAS ownership and environments

1. Use the Expo account that owns EAS project
   `40329ce9-8836-472f-b528-2d758663ce44`:

   ```bash
   ./node_modules/.bin/eas login
   ./node_modules/.bin/eas whoami
   ```

2. Configure the following project variables in each of `development`,
   `preview`, and `production`:

   | Variable | EAS type | Visibility | Source |
   | --- | --- | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | string | plaintext | Owner `.env` |
   | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | string | sensitive | Owner `.env` |
   | `GOOGLE_SERVICES_JSON` | file | secret | Owner `google-services.json` |

   The EAS dashboard is the safest interactive route. If using the CLI, use
   `eas env:set` and let the shell read values from owner-controlled local
   storage; do not paste values into logs, tickets, commits, or chat.

3. Confirm the Firebase file contains an Android client for exactly
   `com.prakashdash.pulsechat`.

4. Configure Android build signing under the owner account:

   ```bash
   ./node_modules/.bin/eas credentials:configure-build \
     --platform android --profile preview
   ```

   Let EAS create or reuse the owner-controlled remote Android keystore. Do not
   download or add the keystore to the source package. Record the certificate
   SHA-256 in the acceptance record so later builds can prove signing
   continuity.

5. Configure the Firebase Cloud Messaging V1 service-account credential using
   the interactive Android credentials workflow:

   ```bash
   ./node_modules/.bin/eas credentials --platform android
   ```

   This server credential is separate from `GOOGLE_SERVICES_JSON`.

## 4. Run the configured local gate

Restore `.env` and `google-services.json` only in the working directory, then:

```bash
npm run release:gate:configured
```

This gate validates the real Supabase values, Firebase package match,
fail-closed release config, generated Gradle identity, permissions, launcher
resources, notification resource, and Google Services plugin wiring. It does
not sign an APK.

## 5. Build the signed preview APK

```bash
npm run build:android:preview
```

The `preview` profile produces an internal-distribution APK with remote signing
credentials. Do not accept a development-client APK as the final candidate.
Record the EAS build ID, immutable artifact URL, completion time, app version,
versionCode, and build page in `docs/PHASE24_ACCEPTANCE.md`.

Download the APK into an owner-controlled release directory and record its
digest:

```bash
sha256sum PulseChat-1.0.0-24-preview.apk
```

## 6. Install and test the same artifact

Use one downloaded APK for both phones and for every Phase 24 test.

Clean-install path:

```bash
adb uninstall com.prakashdash.pulsechat
adb install PulseChat-1.0.0-24-preview.apk
```

Upgrade path: install the last accepted signed PulseChat build first, preserve
its signed-in/cache state, then run:

```bash
adb install -r PulseChat-1.0.0-24-preview.apk
```

If Android reports a signing mismatch, stop. Do not uninstall to conceal the
problem; recover the prior owner keystore or deliberately document that this is
a new incompatible signing lineage.

Complete every row in `docs/PHASE24_ACCEPTANCE.md`, including the Phase 22 core
two-phone flow and the Phase 23 TalkBack/font-scale regression. Do not use
Android Settings > Force stop for the background-push test because Android
suppresses delivery until the app is opened again.

## 7. Production AAB after preview acceptance

Only after the preview artifact is signed off:

1. Increment the committed versionCode for any replacement binary.
2. Update `app.json` and `release/android-release-baseline.json` together.
3. Re-run both source and configured gates.
4. Produce the Play-compatible AAB:

   ```bash
   npm run build:android:production
   ```

Phase 25 owns Play Console metadata, internal-track upload, Data safety,
content rating, store assets, and pre-launch findings. Phase 24 does not claim
Play submission.

## Rollback and incident notes

- Keep the last accepted artifact, build ID, SHA-256, signing certificate
  fingerprint, and versionCode in owner-controlled release records.
- Android cannot downgrade to a lower versionCode through a normal upgrade.
  Roll forward with a higher versionCode for a corrected candidate.
- Disable internal distribution for a bad EAS artifact and notify testers not
  to install it.
- Revoke or rotate exposed Supabase/EAS/Firebase credentials immediately; a
  replacement APK alone does not invalidate leaked server credentials.

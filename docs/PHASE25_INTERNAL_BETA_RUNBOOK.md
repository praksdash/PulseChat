# Phase 25 Play Store internal-beta runbook

Status: **source readiness complete; owner Play Console actions pending**

## 1. Entry gate

- Sign Phase 22, Phase 23 and Phase 24 physical-device records for the exact
  candidate that will be promoted.
- Apply/verify all migrations through Phase 24 and keep both Edge Functions,
  webhook and secrets healthy.
- Confirm `npm ci`, `npm run qa:phase25` and
  `npm run release:gate:configured` pass from clean source.

## 2. Owner/policy inputs

1. Create `release/play-store/owner-inputs.json` from the example.
2. Use a monitored support email and owned public HTTPS URLs.
3. Run `npm run play:audit`.
4. Run `npm run play:render-public`; review and host all generated pages.
5. Open each public URL in a signed-out browser and on a phone.
6. Review Data safety/content-rating answers against the current console.

## 3. Authentic assets

- Use the committed icon and feature graphic.
- Capture at least two real phone screenshots by following the asset README.
- Rerun `npm run play:audit`; it rejects absent/invalid screenshots.

## 4. Signed production AAB

1. Confirm EAS remote signing belongs to the intended app lineage.
2. Build from clean source with `npm run build:android:production`.
3. Record EAS build ID, source revision/package SHA-256, AAB SHA-256,
   application ID, versionName/versionCode and signing certificate SHA-256.
4. Never reuse a Play versionCode after an uploaded artifact. If code changes,
   deliberately increment both `app.json` and the release baseline, then rerun
   all Phase 24/25 gates.

## 5. Play Console setup

- Create/select `com.prakashdash.pulsechat` exactly once.
- Enable Play App Signing and securely retain the upload-key lineage.
- Complete App content: privacy policy, app access, ads, target audience/content,
  content rating, Data safety and account deletion.
- Add the store listing and authentic assets.
- Upload the AAB to **Internal testing**, initially as a controlled tester list.
- Do not promote directly to production.

## 6. Pre-launch report

Review crashes/ANRs, Android compatibility, security warnings, accessibility and
screenshots. Reproduce every high-severity finding on the exact build. Fix only
release blockers; do not expand features during the beta-readiness phase.

Any code/config change creates a new candidate and requires a new versionCode,
full automated gate and targeted two-phone regression.

## 7. Controlled beta

- Start with 5–20 invited adult testers using non-sensitive test content.
- Collect build ID, device/Android version, reproduction steps and evidence.
- Require direct/group text, images, receipts, push routing, offline replay,
  restart persistence, privacy controls and account deletion to pass.
- Classify crashes, data leakage, authorization bypass, message loss/duplicate,
  broken push, unusable primary action and signing/package mismatch as blockers.

## 8. Rollback

Stop the rollout/testing release, disable the affected internal track artifact
where the console permits, notify testers not to use the build, preserve logs,
and repair forward with a higher versionCode. Never attempt to overwrite an
uploaded AAB or switch signing identity.

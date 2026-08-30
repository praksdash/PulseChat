# PulseChat Phase 26 source release report

Date: 2026-08-29 UTC  
Status: **SOURCE ENGINEERING COMPLETE — OWNER OPERATIONS EVIDENCE PENDING**

## Delivered

- bounded, authenticated metadata-only crash/startup/API diagnostics;
- app-level render-crash recovery UI and global JS error capture attempt;
- sampled/slow/error Supabase request timing by sanitized operation category;
- Expo push ticket/receipt lifecycle, bounded polling and invalid-token cleanup;
- private job/alert ledgers plus rate-limit and Storage aggregate dashboards;
- retention maintenance and source/configured Phase 26 audit;
- monitoring, backup/restore, incident and acceptance runbooks.

## Privacy and scope

No new V1 product feature was added. Diagnostics reject message/profile content,
request URLs/bodies, tokens and raw stacks. Normal authenticated clients cannot
read operational tables. The package adds no Sentry/Crashlytics dependency and
uses the existing Supabase deployment boundary.

## Automated evidence

`npm run qa:phase26` passed on 2026-08-29 UTC:

- TypeScript and ESLint;
- 30/30 unit/static regression tests;
- committed-secret scan and no high/critical production dependency finding;
- configured Supabase/Firebase preflight;
- accessibility, Android release, and source-native audits;
- Phase 25 Play readiness with both phone screenshots;
- Phase 26 observability/operations source audit;
- Android Metro export;
- Web static export with 40 routes.

The dependency audit still reports 11 moderate transitive Expo CLI/config/xcode
findings. Its proposed forced remediation breaks the pinned Expo SDK 57 set, so
it remains a documented dependency-review item rather than an unsafe forced
upgrade. Source-only operations audit has one expected warning until real owner
monitoring/backup/restore evidence exists.

## npm clean-install hotfix — 2026-08-30 UTC

The first package's npm 11-generated lockfile omitted the optional nested
TypeScript 5.9.3 peer required by an EAS CLI helper when npm 10 resolves the
tree. The corrected lock retains root TypeScript 6.0.3 and adds only the nested
EAS compatibility entry. Fresh `npm ci` runs installed all 1,223 packages
successfully under both npm 10.9.4 and npm 11.9.0. The Phase 26 audit now locks
this compatibility contract.

## Config-aware QA hotfix — 2026-08-30 UTC

The Phase 23 static audit now recognizes `src/constants/theme.ts` as a semantic
theme-definition file, where declaring the base white token is intentional.
The Phase 25 source test now accepts both package states: missing private owner
inputs produce the expected source warning, while configured valid owner inputs
correctly produce no warning.

The native Android smoke test now uses a Windows directory junction for its
temporary `node_modules` link. This avoids the administrator/Developer Mode
permission required by a standard Windows symbolic link while retaining the
same isolated prebuild behavior.

Expo prebuild is launched through the current Node executable and Expo's
JavaScript CLI entrypoint instead of the platform-specific `.bin` shim. This
prevents a null Windows process status when the Unix-style `expo` shim cannot
be executed directly.

Generated Android resource paths are normalized before checking for the
notification icon, so the audit accepts both Windows backslashes and POSIX
forward slashes without weakening the required filename/folder check.

The phase-scoped Android/web export wrapper also launches Expo through the
current Node executable and Expo's JavaScript CLI entrypoint. This prevents the
Windows `ENOENT` failure caused by directly spawning the Unix `.bin/expo` shim.

## Unclaimed external evidence

This report does not claim a deployed migration/function, live Cron schedule,
external notification channel, backup coverage, successful restore drill,
production incident exercise, signed AAB, or physical-device acceptance.
Complete `docs/PHASE26_ACCEPTANCE.md` before accepting the phase.

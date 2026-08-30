# PulseChat Phase 25 source release report

Date: 2026-08-29 UTC  
Status: **SOURCE ENGINEERING COMPLETE — OWNER PLAY/BETA EVIDENCE PENDING**

## Candidate identity

- Application ID: `com.prakashdash.pulsechat`
- Version: `1.0.0`
- VersionCode: `24`
- Phase 25 deliberately preserves the reviewed Phase 24 binary identity until
  the owner creates/uploads the exact production AAB. Any post-upload code
  change requires a higher committed versionCode.

## Delivered

- privacy, account-deletion and support public-page templates;
- Data safety and content-rating working answers;
- truthful store listing and beta release notes;
- 512 × 512 Play icon and 1024 × 500 opaque feature graphic;
- authentic phone-screenshot specification and two 1080 × 1920 candidate
  screenshots with personal identity replaced by generic test data;
- ignored owner contact/URL/app-access configuration boundary;
- public-page renderer and source/configured Play readiness audits;
- internal-track, pre-launch, beta, rollback and sign-off runbooks.

## Automated evidence

`npm run qa:phase25` passed:

- TypeScript and ESLint;
- 22/22 unit/static regression tests;
- secret scan and no high/critical production dependency advisory;
- source preflight and accessibility audit;
- Phase 24 release identity and native prebuild regression;
- Phase 25 listing/policy/Data safety/content-rating/asset audit;
- Android Metro export;
- Web static/server-render export with 40 routes.

`npm run release:gate:configured` also passed with the owner's local Supabase
and Firebase client configuration. The known Web Expo notification-listener
warning remains expected because closed-browser Web Push is outside V1.

The audit continues to report 11 moderate transitive Expo CLI/config/xcode
advisories. The available forced remediation is a breaking SDK change; there
are no high/critical production findings.

## Intentional source-only warning

Real developer/support contact plus hosted HTTPS URLs are owner inputs and are
not invented or committed. The included screenshots must still be compared to
the exact signed candidate before Play submission.

## Unclaimed external evidence

This report does not claim a signed production AAB, Play Console form/upload,
Play App Signing result, pre-launch report, hosted public pages, reviewer access,
or controlled beta. Complete every row in `docs/PHASE25_ACCEPTANCE.md` before
accepting Phase 25.

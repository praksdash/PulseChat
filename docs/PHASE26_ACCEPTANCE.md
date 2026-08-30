# PulseChat Phase 26 acceptance

Status: **SOURCE CANDIDATE — OWNER DEPLOYMENT AND RECOVERY EVIDENCE PENDING**

Phase 26 is accepted only when every required row is evidenced for the deployed
Prototype V1 backend and one exact signed Android candidate.

## Provenance and deployment

| Evidence | Required result | Observed / link |
| --- | --- | --- |
| Source revision/package SHA-256 | Recorded | |
| App version / versionCode / EAS build ID | Exact candidate recorded | |
| Phase 26 migration | Applied after Phase 24 migration | |
| `supabase/phase26_verify.sql` | Pass | |
| `send-message-push` deployment | Phase 26 ticketed status deployed | |
| `poll-push-receipts` deployment | Secret-protected deployment recorded | |
| Receipt Cron | Five-minute schedule; secret stored privately | |
| `npm run ops:audit` | Zero failures | |

## Detection and attribution

| Check | Required result | Result / evidence |
| --- | --- | --- |
| Startup diagnostic | Correct platform/version/profile, no content | |
| API timing/error sample | Sanitized operation only | |
| Render crash exercise | Accessible recovery UI + fingerprint row | |
| Push lifecycle | `claimed -> ticketed -> delivered` | |
| Invalid installation | Only invalid token disabled | |
| Job freshness | Success less than five minutes old | |
| External monitor | Non-2xx, stale poller and critical alerts notify owner | |
| Alert thresholds | Crash/API/startup/push/storage test evidence | |
| Rate-limit dashboard | Aggregates visible only to trusted operator | |
| Storage dashboard | Counts/bytes match expected buckets | |

## Recovery

| Check | Required result | Result / evidence |
| --- | --- | --- |
| Database backup | Current automated backup confirmed | |
| Private Storage backup | Both private buckets covered | |
| Isolated restore drill | Database + Storage restored and verified | |
| RPO/RTO | Meets 24-hour / four-hour beta targets | |
| Incident tabletop | One critical scenario completed | |
| Dependency review | Owner and next review date recorded | |

## Physical regression

Complete the Phase 22 two-phone core flow, Phase 23 accessibility checks, Phase
24 signed-build checks and Phase 25 internal-beta checks on the same candidate.
Add the Phase 26 startup/API/crash/receipt cases from the observability runbook.

## Sign-off

| Role | Name | UTC date | Decision |
| --- | --- | --- | --- |
| Owner / release manager | | | |
| Backend / operations reviewer | | | |
| Android QA reviewer | | | |

Do not mark this document accepted from source checks alone.

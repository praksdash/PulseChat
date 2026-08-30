# Phase 26 incident runbook

## Severity

| Severity | Examples | Response target |
| --- | --- | --- |
| Critical | Data exposure, authorization bypass, signing compromise, widespread message loss/duplicates, unusable auth/messaging | Stop beta activity immediately; owner begins response within 15 minutes |
| High | Crash burst, push failure spike, receipt poller outage, failed backup, private Storage anomaly | Investigate within 30 minutes; halt rollout if user impact is growing |
| Medium | Isolated recoverable crash, slow startup/API threshold, single-device notification issue | Triage during the same working day |

## Response sequence

1. **Detect and declare:** record UTC time, alert key, app version/versionCode,
   EAS build ID, Supabase migration/function versions and incident owner.
2. **Preserve evidence:** export only relevant aggregate diagnostics, function
   logs, alert/job rows and release provenance. Do not copy message content into
   the incident record.
3. **Contain:** stop Play rollout/testing, disable the affected Cron/Webhook or
   Edge Function when appropriate, revoke exposed credentials, and tell testers
   not to use a bad artifact. Do not delete evidence first.
4. **Diagnose:** separate client crash, API/backend, authorization/RLS, Storage,
   push ticket, receipt-worker and external-provider failure domains.
5. **Recover:** repair forward with a migration/function deployment or higher
   Android versionCode. Restore only through the backup runbook and only after
   confirming the restore point.
6. **Verify:** rerun Phase 21/24/26 SQL verification, source/configured gates,
   two-phone core messaging, background push and the originally failing case.
7. **Close:** monitor at least 30 minutes, document root cause, user impact,
   timeline, remediation, credential rotations and prevention action.

## Targeted controls

- Push outage: disable the scheduled poller only if it is causing load; message
  delivery must continue independently. Preserve ticket/receipt rows.
- Invalid token spike: confirm `DeviceNotRegistered` before disabling tokens;
  never disable by user ID alone when one installation is bad.
- RLS/data exposure: suspend beta access, rotate server credentials, preserve
  audit evidence, correct policies/functions, and verify with two separate users.
- Storage anomaly: block new uploads if needed, keep buckets private, compare
  object checksums/manifests, and restore only missing/corrupt objects.
- Client crash: group by fingerprint + app version/platform; never add raw stack
  or user content to `client_diagnostics` as a shortcut.

Every critical/high incident requires a short post-incident review and an owner
assigned to each prevention action before rollout resumes.

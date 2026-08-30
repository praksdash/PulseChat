# Phase 26 observability runbook

This runbook activates the source-owned Phase 26 controls for the existing
Prototype V1. Keep all secrets and evidence outside Git and EAS source uploads.

## 1. Deploy the backend

1. Apply migrations through
   `supabase/migrations/202608290019_phase26_observability.sql`.
2. In the Supabase SQL editor, run `supabase/phase26_verify.sql` and retain the
   successful output with the candidate release evidence.
3. Redeploy `send-message-push`; Phase 26 changes its successful ticket state
   from `sent` to the accurate `ticketed` state.
4. Deploy `poll-push-receipts` with JWT verification disabled. Its private
   header secret is the authorization boundary.
5. Create a cryptographically random 32-byte `PUSH_RECEIPT_SECRET` in Supabase
   Edge Function secrets. It must differ from `PUSH_WEBHOOK_SECRET`. Keep the
   existing `EXPO_ACCESS_TOKEN` configured when Enhanced Push Security is on.

Do not add the receipt secret, service-role key or Expo access token to `.env`,
the app bundle, source control, screenshots, tickets, or chat.

## 2. Schedule receipts and maintenance

Create a Supabase Cron HTTP job with these exact properties:

| Field | Value |
| --- | --- |
| Method | POST |
| URL | `https://<project-ref>.supabase.co/functions/v1/poll-push-receipts` |
| Schedule | `*/5 * * * *` |
| Header | `x-pulsechat-receipt-secret: <PUSH_RECEIPT_SECRET>` |
| Body | `{}` |

Store the URL and header value through Supabase Vault/secret-backed Cron
configuration, not as literal migration text. After two runs, confirm
`public.operational_jobs` contains `push_receipt_poll` with `status = 'ok'` and
a `last_succeeded_at` less than five minutes old.

The worker waits 15 minutes before asking Expo for a receipt, checks at most
1,000 tickets per run, retries missing receipts within a bounded window,
disables `DeviceNotRegistered` tokens, evaluates alerts, and performs retention
maintenance. A ticket accepted by Expo is not labelled delivered until an
`ok` receipt is returned.

## 3. Connect operator alerts

At minimum, configure one monitored external channel (email, Slack, PagerDuty,
or equivalent) for Supabase function/cron failures and query the active alert
ledger every five minutes. The external monitor must alert when:

- `poll-push-receipts` returns non-2xx;
- `push_receipt_poll.last_succeeded_at` is 15 minutes stale;
- `public.operational_alerts.active` contains a critical row.

The source thresholds are recorded in
`release/operations/phase26-observability.json`. Do not silently relax them
during the internal beta; record and review any change.

## 4. Operator dashboard queries

Run these only in the authenticated Supabase SQL editor or equivalent trusted
server tooling:

```sql
select * from public.operational_alerts
where active
order by severity, alert_key;

select * from public.operational_jobs
order by job_key;

select status, error_code, count(*)
from public.push_delivery_log
where created_at >= now() - interval '24 hours'
group by status, error_code
order by status, error_code;

select event_type, operation, outcome, count(*) as samples,
  percentile_disc(0.95) within group (order by duration_ms) as p95_ms
from public.client_diagnostics
where occurred_at >= now() - interval '24 hours'
group by event_type, operation, outcome
order by event_type, operation, outcome;

select * from pulsechat_private.rate_limit_dashboard
order by last_activity_at desc;

select * from pulsechat_private.storage_dashboard
order by bucket_id;
```

The client diagnostics table never contains messages, names, request bodies,
full URLs, tokens, or raw stacks. Treat the pseudonymous `user_id` as personal
data and restrict operator access accordingly.

## 5. Smoke test

1. Install the exact signed candidate on two Android phones.
2. Sign in with controlled adult test accounts and exercise auth, Chats,
   direct/group messages, image send, search, settings and reconnect.
3. Confirm startup and sampled API rows appear with the correct app version and
   build profile, but no user content.
4. Send a push while the recipient app is backgrounded. Confirm the delivery
   row transitions `claimed -> ticketed -> delivered` after the scheduled poll.
5. Use a deliberately retired test installation/token and confirm an Expo
   `DeviceNotRegistered` receipt disables only that token.
6. Confirm the app-level recovery screen is accessible in a debug-only fault
   exercise. Do not add a crash button to the release UI.

Record build ID, versionCode, migration version, function deployment versions,
Cron evidence, dashboard output and test time in `docs/PHASE26_ACCEPTANCE.md`.

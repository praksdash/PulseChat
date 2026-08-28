PulseChat Phase 21 V1 — Security Hardening Package
==================================================

Objective
---------
Harden the existing Prototype V1 messaging scope without adding calls, secret-chat E2EE, arbitrary files, paid observability, or Telegram-scale anti-abuse infrastructure.

Implemented
-----------
- Private bounded server-side rate limits for messages, reports, profile writes, and remote push tests.
- Message retry idempotency remains keyed by sender + client_message_id.
- Profile changes use update_my_profile(); direct table updates are revoked.
- Profile avatar paths must point to a real, owned, size/MIME-valid Storage object.
- New chat images require the canonical conversation/uploader/client-message JPEG path.
- create_image_message verifies the actual private Storage object MIME and size.
- Rejected fresh image commits remove the new unattached object best-effort.
- Native auth/cache/outbox state uses authenticated AES-256-GCM envelopes.
- Readable Phase 19 native AES-CTR values upgrade on first use.
- Browser auth is session-only; browser message cache/outbox data is memory-only.
- Signed media URLs are stripped from persistent offline snapshots.
- Push webhook secret comparison is constant-time and 500 responses are generic.
- Empty-group account deletion also attempts group-avatar cleanup.
- Secret scan and high/critical npm dependency gates are included.

Database
--------
Apply:
  supabase/migrations/202608280017_phase21_security_hardening.sql

Verify:
  supabase/phase21_verify.sql

Edge Functions
--------------
Redeploy after the migration:
  npx supabase functions deploy send-message-push --no-verify-jwt
  npx supabase functions deploy delete-account --no-verify-jwt

No new Edge Function secret is introduced. Preserve the existing PUSH_WEBHOOK_SECRET, EXPO_ACCESS_TOKEN, Supabase server credential, Firebase configuration, local .env, and google-services.json outside this package.

Commands
--------
npm ci
npm run verify:security
npm run check:android
npx expo export --platform web --output-dir dist-phase21-web-check
npx expo start -c

Automated result on 2026-08-28 UTC
----------------------------------
- TypeScript: pass
- ESLint: pass
- unit tests: 6/6 pass
- committed-secret scan: pass
- high/critical production dependency gate: pass
- Android Metro export: pass
- Web static export: pass
- npm audit residual: 11 moderate transitive Expo CLI/config/xcode findings; 0 high, 0 critical

The audit's force-fix suggestion makes breaking changes to SDK-controlled Expo packages and is not compatible with this pinned SDK 57 project. Recheck on an SDK 57-compatible upstream release.

Deletion and media boundary
---------------------------
Delete-for-everyone immediately redacts durable content and removes attachment metadata, so new signed URLs cannot be minted. Physical object deletion is best-effort; an orphan is not readable through app RLS.

Account deletion removes account/profile/membership/settings/token data and anonymizes retained sender references. Messages and photos already shared remain in conversation history, as stated in the confirmation UI. Prototype V1 does not claim legal/compliance retention automation or raw-byte malware scanning.

Handoff status
--------------
Implementation and automated local checks are complete. Apply/verify the migration, redeploy both changed Edge Functions, and repeat the combined Phase 20/21 two-Android-device V1 gate before accepting Phase 21 or advancing the roadmap.

Recommended commit
------------------
feat: harden Phase 21 Prototype V1 security

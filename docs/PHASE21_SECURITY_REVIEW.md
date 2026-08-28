# Phase 21 Prototype V1 security review

## Result

The reviewed package closes the actionable V1 gaps identified after Phase 20: unauthenticated local ciphertext integrity, persistent browser message data, unrestricted high-volume write paths, caller-trusted media metadata, broad direct profile mutation, signed-URL persistence, and overly detailed Edge Function failures.

## Findings and disposition

| Area | Phase 20 risk | Phase 21 disposition |
| --- | --- | --- |
| Native local encryption | AES-CTR provided confidentiality but no tamper authentication | AES-256-GCM with per-write random nonce and storage-key associated data; legacy read/migrate only |
| Browser persistence | Auth, cache, and outbox could persist in browser-controlled storage | Auth moved to session storage; message cache/outbox memory-only; legacy keys removed when touched |
| Message abuse | Membership/block RLS existed but no per-sender volume bound | 60/minute and 1,000/hour on fresh durable inserts |
| Report abuse | Private and idempotent but no volume bound | 10/hour and 50/day for fresh reports; duplicates stay idempotent |
| Push diagnostics | Authenticated user could repeatedly generate external push traffic | 5/hour caller-bound claim |
| Profile writes | Own-row RLS still allowed direct broad UPDATE | Direct UPDATE revoked; narrow caller-bound RPC validates fields and avatar object |
| Chat media | Canonical path and caller-supplied metadata checked | Actual Storage row/MIME/size must match before attachment commit |
| Failed image commit | Fresh uploaded object could remain unattached | Official client removes an object uploaded by that failed attempt |
| Signed media URLs | Could enter an encrypted offline snapshot | Always stripped before snapshot persistence |
| Webhook secret | Ordinary string comparison | Constant-time byte comparison |
| Edge errors | Internal service/database messages could reach clients on HTTP 500 | Internal detail logged server-side; generic client error returned |
| Empty-group deletion | Group row removed but public group avatar could remain | Account deletion also attempts empty-group avatar removal |
| Dependency review | No repeatable advisory gate | High/critical gate added; moderate upstream findings documented |
| Committed credentials | Ignore rules existed but no automated content scan | Secret signature scan added; google-services.json explicitly excluded |

## Preserved Phase 17 safety controls

The review found the block/report design appropriate for Prototype V1: block enforcement is server-side on direct sends and media uploads; discovery, presence, typing, chat creation, and push behavior also honor blocks; reports are write-only to normal clients and message reports verify current membership plus actual sender identity. Phase 21 keeps these controls and adds regression assertions/tests.

## Accepted residual risks

- Supabase project-level Auth rate limits, CAPTCHA, email abuse controls, Storage quotas, backups, and log retention require owner configuration and cannot be proven from this source package.
- Storage MIME metadata plus official-client JPEG re-encoding is sufficient for the fixed image-only V1 scope, but it is not malware or content scanning. Arbitrary files and rich media remain postponed.
- Physical deletion of a delete-for-everyone image is best-effort after durable metadata redaction. The object is immediately inaccessible through app RLS, but an operator cleanup process is required for guaranteed storage erasure.
- Shared messages/photos remain as anonymized conversation history after account deletion. This is a declared product rule, not a legal-retention compliance system.
- The current npm audit has 11 moderate transitive Expo CLI/config/xcode-path findings. There are no high/critical findings; the offered force remediation makes breaking changes outside the pinned SDK 57 dependency set.
- Crash reporting, centralized security alerts, push receipt monitoring, and operational dashboards remain Phase 26 work.

## Acceptance boundary

Source-level and build verification passed locally. Phase 21 is not accepted until the owner applies the migration, runs `supabase/phase21_verify.sql`, redeploys the changed Edge Functions, configures the environment controls, and completes the real two-device V1 regression in `docs/TESTING.md`.

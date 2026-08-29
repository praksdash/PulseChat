# Phase 22 QA report

## Source-review result

Phase 22 fixes the source-level Prototype V1 correctness issues found during
review and provides a reproducible acceptance gate. No product feature was
added.

| Finding | Risk to V1 | Resolution |
| --- | --- | --- |
| Older/search page response after route change | Messages from chat A could render in chat B | Active user/conversation scope and row-conversation checks added |
| Text/image result after route change | Optimistic or committed A send state could update B's timeline | Send continues safely, but UI mutation is allowed only for its active scope |
| Outbox read during route change | Pending A rows could merge into B | Outbox merge is active-scope guarded |
| Overlapping unread RPCs | Older response could overwrite the newest tab badge | Monotonic latest-request guard added |
| Delayed profile RPC during account change | Prior account profile could replace current state | Profile request sequence and immediate account-bound clearing added |
| Cached notification preferences during account change | Previous account settings could be used briefly | Cached emissions ignored until the current account fetch completes |
| Concurrent first session encryption | Different first-write keys could be generated for one storage key | Per-key initialization promise deduplicates native key creation |
| Search pagination during query change | Old query's next page could append to new results | Pagination response is bound to the originating request sequence |

## Automated evidence

Clean source/package verification completed on 2026-08-28 UTC:

```bash
npm ci
npm run qa:phase22
```

| Check | Result |
| --- | --- |
| Clean dependency installation | Pass — 856 packages installed from lockfile |
| TypeScript | Pass |
| ESLint | Pass |
| Unit tests | Pass — 10/10 |
| Committed-secret scan | Pass |
| Production dependency gate | Pass — 0 high, 0 critical |
| Source preflight | Pass — 0 failures, 2 expected private-file warnings |
| Android Metro export | Pass — React Compiler enabled |
| Web static export | Pass — 40 routes |

The audit reports 11 moderate transitive findings in Expo CLI/config/xcode/uuid
paths. The offered force remediation changes the pinned Expo SDK dependency set
and is not accepted in Phase 22.

The strict connected-device preflight remains separate because `.env` and
`google-services.json` are deliberately excluded from shareable source ZIPs:

```bash
npm run qa:preflight
```

## Boundary

Local automation can validate TypeScript, lint, unit behavior, secret scanning,
dependency severity, app configuration, and Metro exports. It cannot establish
that the owner's migration is applied, the Database Webhook/secrets are live,
FCM reaches a physical device, Android permissions are correct, or app data
survives a real process restart. Those claims require the signed results in
`docs/PHASE22_ACCEPTANCE.md`.

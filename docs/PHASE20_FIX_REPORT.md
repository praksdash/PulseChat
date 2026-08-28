# Phase 20 V1 fix report

## Scope decision

This package follows the Prototype V1 boundary: direct realtime text/images, unread and delivered/read state, notifications, a small group, and restart persistence on two Android phones. Existing optional features are preserved, but no new channel/call/bot/desktop/advanced-media infrastructure was added.

## Issues corrected

| Issue | Risk | Correction |
| --- | --- | --- |
| `AsyncStorage.multiRemove` used with AsyncStorage v3 | TypeScript failed; cache/account cleanup could not build | Replaced with the v3 `removeMany` API |
| No lockfile | Future installs could resolve different dependency patches | Added `package-lock.json`; use `npm ci` |
| Lint command had no ESLint dependency/config | Advertised verification was not reproducible | Added Expo-compatible ESLint dependencies/config and a direct offline lint command |
| One global in-flight latest refresh | A newly opened chat could join an old chat's promise and miss its own reconciliation | Added a tested user+conversation keyed trailing coalescer |
| Async responses lacked route/request guards | Slow old Chats/summary/message requests could overwrite newer state | Added mount, sequence, conversation-key, and detail-conversation checks |
| Message `renderItem` changed on unrelated screen renders | Composer typing could cause avoidable list work | Memoized the render callback and supporting row helpers |
| Bubble memo comparators ignored action callbacks | Retry/reaction/open handlers could retain stale connectivity or state | Compare all interaction callbacks; correctness takes priority over an unsafe memo skip |
| Virtualized media image lacked a recycling key | Reused native views could briefly show an incorrect image | Added URI-based `recyclingKey` |
| Signed URL requests could duplicate | Concurrent history/detail refreshes could sign the same path repeatedly | Share per-path in-flight promises and retain batch signing |
| Media URL cache survived account changes | A later account in the same process could retain private capability URLs in memory | Clear/invalidate the cache on authenticated-user changes |
| Offline cache writes were concurrent | Older writes could finish last and replace a newer snapshot | Serialize writes per cache key |
| Project/README state still said Phase 18 | Handoff instructions contradicted the package | Updated Phase 20/V1 scope, verification, limitations, and next step |
| Firebase file was unconditionally referenced | Local export emitted a missing-config warning before push was configured | Added dynamic config that includes the file only when present; real push builds still require it |
| Coalescing behavior had no automated test | A subtle concurrency regression could reappear | Added three Node tests for burst collapse, key independence, and failure cleanup |

## Verified locally

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` — 3 passing
- `npm run check:android` — Android bundle exported successfully

## Still requires the owner environment

- apply/verify all Supabase migrations and RLS policies in the target project;
- deploy/redeploy the two Edge Functions and configure their secrets/webhook;
- add the correct Firebase `google-services.json`;
- create an EAS Android development/preview build;
- run the complete two-device acceptance test; and
- confirm background/terminated push delivery, permissions, and restart persistence on real phones.

The package is code-complete for Phase 20 V1, but the project Definition of Done correctly prevents calling the phase accepted until those real-device checks pass.

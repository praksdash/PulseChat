PulseChat Phase 20 — Performance Optimization
==============================================

Objective
---------
Reduce duplicate network work, unnecessary list rendering and repeated media/cache processing while preserving all Phase 0–19 behavior.

What Phase 20 optimizes
-----------------------
- Chats FlatList rendering is tuned for a messenger workload (smaller initial window, batched cells, native clipping).
- Message FlatList rendering is tuned for long histories instead of mounting 40 message rows immediately.
- Chat rows, avatars, text bubbles and media bubbles are memoized so unrelated state changes do not repaint every visible row.
- Reused Intl.DateTimeFormat instances avoid allocating a formatter for every visible chat/message render.
- Active-chat latest reconciliation coalesces overlapping receipt/reconnect/app-state refreshes while guaranteeing an authoritative trailing refresh.
- Conversation activity bursts are coalesced before refreshing the Chats list.
- Private media signed URLs are cached in memory for less than their server expiry and are batch-signed only for missing paths.
- Offline cache writes skip byte-identical payloads, avoiding repeated AES/AsyncStorage work on native devices.
- Reconnect-only refresh effects no longer perform a second duplicate fetch on the initial online mount.

Database / backend
------------------
No Phase 20 migration is required. Existing pagination and indexes from earlier phases remain authoritative.

No new dependency
-----------------
Phase 20 uses existing React Native / Expo / Supabase capabilities only.

Commands
--------
npm run typecheck
npx expo start -c

Optional Android bundle check
-----------------------------
npm run check:android

Acceptance test
---------------
1. Open Chats with 20+ conversations if available and scroll quickly; rows should remain stable with no blank/stuck entries.
2. Open a conversation with 100+ messages and scroll through older pages repeatedly.
3. Receive a burst of messages; Chats preview/unread state should update while avoiding visible refresh flicker.
4. Open a media-heavy conversation, leave it, reopen it, and confirm images appear without repeated loading churn.
5. Send messages, receive delivered/read receipts, edit/react/delete and confirm bubble state updates correctly despite memoization.
6. Toggle Light/Dark/System theme and confirm memoized rows immediately adopt the new theme.
7. Go offline and back online; Phase 19 queued messages/cache behavior must still reconcile correctly.
8. Regression: push, mute, privacy/block/report, groups, search and account settings still work.

Important
---------
Memo comparators intentionally ignore callback identity but compare every visual/state-bearing prop. Theme changes still propagate through React context, so memoized components are not frozen across appearance changes.

PulseChat Phase 20 V1 — Fixed Performance Package
=================================================

Objective
---------
Make the Prototype V1 messaging paths responsive and race-safe without adding Telegram-scale infrastructure or expanding product scope.

Prototype V1 boundary
---------------------
Required: two Android phones, two email accounts/profiles, user discovery, direct realtime text/images, unread and delivered/read state, push notifications, a small group, and persistence across restart.

Deferred: calls, secret-chat E2EE, stories, bots, channels, multi-device/desktop clients, expanded audio/video/file messaging, and paid observability.

Corrected Phase 20 implementation
---------------------------------
- Chats and message FlatLists use bounded render windows and batched mounting.
- Message rendering uses a stable render callback; memo comparators include interaction callbacks so retry/reaction handlers cannot retain stale connectivity state.
- Reconciliation is keyed by user + conversation. Same-chat bursts collapse into one latest trailing run, while a newly opened chat never joins the old chat's request.
- Chats, summaries, message pages, and message-detail refreshes ignore stale async responses.
- Private media URLs use bounded in-memory caching, batch signing, and in-flight request deduplication.
- Media URL state is cleared when the authenticated account changes.
- Offline cache writes are serialized per key, remain latest-write-wins, and skip byte-identical snapshots.
- Expo SDK 57 / AsyncStorage v3 uses removeMany rather than the removed multiRemove API.
- The dependency lockfile, ESLint configuration, unit tests, and one-command verification are included.
- Local Expo checks omit Firebase config only when google-services.json is absent; real push builds still require that file.

Database/backend
----------------
No Phase 20 migration is required. Prototype V1 continues to use the existing membership, message pagination, receipt, attachment, search, and Realtime indexes/RLS. The Chats screen intentionally caps the V1 list at 50 conversations; true chat-list cursor pagination is postponed until the product needs more than the prototype workload.

Commands
--------
npm ci
npm run verify
npm run check:android
npx expo start -c

Automated result expected
-------------------------
- TypeScript: pass
- ESLint: pass
- keyed trailing-request tests: 3/3 pass
- Android Metro export: pass

Two-device acceptance test
--------------------------
1. Configure Supabase and Firebase/FCM, including root google-services.json.
2. Install a development/preview build on two Android phones.
3. Create two accounts, set profiles, find each other, and open a direct chat.
4. Exchange text and images in realtime.
5. Verify unread, sent/delivered/read state, foreground/background push, and notification-tap routing.
6. Create a small group and exchange group messages.
7. Build at least 100 messages in a conversation, load older pages repeatedly, and confirm stable scrolling.
8. Send a burst of messages and confirm the Chats preview/unread state updates without flicker or duplicates.
9. Go offline, send text, reconnect, and confirm exactly one durable message per client_message_id.
10. Close and reopen both apps and confirm conversations/messages persist.
11. Sign out and sign in as another account on the same device; confirm old private media never appears from memory cache.

Handoff status
--------------
Implementation and automated local checks are complete. Real-device Supabase, FCM, permission, background-delivery, and restart behavior must still be verified before Phase 20 is marked accepted under the project's Definition of Done.

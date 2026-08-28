PulseChat Phase 19 — Offline & Error Handling
==============================================

Objective
---------
Make the existing realtime messenger resilient to temporary network loss without changing the database schema.

What Phase 19 adds
------------------
- Backend reachability monitoring on Android/iOS/web with foreground and periodic rechecks.
- Global offline banner with manual Retry.
- Encrypted native offline cache for the recent chat list, conversation summaries and recent message pages.
- Cached chats/messages are shown when the backend cannot be reached.
- Durable encrypted text-message outbox on native devices (browser storage uses normal origin-scoped web storage).
- Offline text messages render immediately as "Waiting for connection…" and automatically flush after reconnect.
- Existing client_message_id idempotency is preserved, so a lost response/retry cannot create duplicate durable messages.
- Photos selected while offline remain queued in the current app session and automatically retry when connectivity returns.
- Network-like send failures move messages back to queued state instead of becoming permanent failures.
- Authorization/validation failures remain failed and require explicit retry/correction.
- Edit/delete/reaction and old-message search actions provide explicit offline errors rather than ambiguous request failures.
- Chat list and chat history reconcile with PostgreSQL once connectivity returns.
- Permanent account deletion also clears the local cache and pending text outbox.

No migration
------------
Phase 19 is client-resilience work. It does not change PostgreSQL, RLS, Storage or Edge Functions.

Important media limitation
--------------------------
Text outbox entries survive an app restart. Pending image picker/camera URIs are intentionally not persisted because mobile temporary/content URIs are not guaranteed to remain readable after a process restart. An image queued while offline auto-retries if the current app session remains alive; if the app is killed, reselect the image after reopening.

Commands
--------
npm run typecheck
npx expo start -c

Suggested acceptance test
-------------------------
1. Open Chats and one conversation while online so the device has a cache.
2. Disable Wi-Fi/mobile data.
3. Return to Chats: the offline banner appears and saved chats remain visible.
4. Open the cached conversation: saved recent messages remain visible.
5. Send two text messages while offline. Both show "Waiting for connection…".
6. Fully leave/re-enter the chat while still offline: queued text messages remain visible.
7. Restore network. The banner disappears and both text messages send automatically once, with no duplicates.
8. Disable network, choose a photo, and confirm it shows queued. Restore network without killing the app and confirm it uploads automatically.
9. While offline, try edit/delete/react/search-old-message and confirm a clear connection-required message is shown.
10. Historical Phase 19 web check: cached list/text outbox used browser-origin storage.

Phase 21 security override
--------------------------
Native Phase 19 AES-CTR values now migrate to authenticated AES-256-GCM on a successful read. Web auth is session-only, and web message cache/outbox data is memory-only; the historical persistent-web-cache behavior above is intentionally removed.

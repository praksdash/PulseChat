PulseChat Phase 16 — Search
===========================

Phase 16 expands the Search tab from people-only discovery into authenticated global search.

Included:
- People search (existing Phase 7 behavior preserved)
- Direct/group chat search
- Message/body + image-caption search across conversations the caller belongs to
- All / People / Chats / Messages filters
- Debounced search with stale-request protection
- Message-result highlighting
- Message-result pagination
- Tap a message result to open an authorized timeline window around that exact message
- Highlighted target message + “Back to latest” control
- Deleted messages excluded from search
- Membership enforcement inside PostgreSQL RPCs
- pg_trgm GIN indexes for message bodies and group titles

Install:
1. Copy this package over the current PulseChat source while preserving local .env,
   google-services.json, android/, node_modules/ and the CURRENT synced package-lock.json.
2. Run supabase/migrations/202608160014_phase16_search.sql in Supabase SQL Editor.
3. Run supabase/phase16_verify.sql.
4. No new npm/native dependencies were added. No EAS/Android rebuild is required for Phase 16
   if you are using Metro. For a preview APK, create a new EAS preview build to bundle the JS.
5. Run npm run typecheck locally against your installed dependencies.

Acceptance tests:
- Search a profile name -> People result opens public profile.
- Search a direct-chat peer or group title -> Chats result opens the conversation.
- Search a word from an old text message -> Messages result appears.
- Search a word from an image caption -> image message appears.
- Tap an old message result -> chat opens around that message and highlights it.
- Tap Back to latest -> current timeline returns.
- Delete a matching message -> it no longer appears in new search results.
- User outside a conversation cannot retrieve that conversation's messages through search/window RPCs.

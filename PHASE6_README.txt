PULSECHAT — PHASE 6 DATABASE ARCHITECTURE
========================================

WHAT CHANGED
------------
Phase 6 adds the production messaging relational model and RLS foundation.
The existing Android UI remains runnable and intentionally continues to show
mock chat data. Real chat creation begins in Phase 8; realtime messaging begins
in Phase 9.

NEW DATABASE OBJECTS
--------------------
public.conversations
public.conversation_members
public.messages
public.message_receipts
public.attachments
pulsechat_private.* RLS/trigger helpers

NEW SOURCE FILE
---------------
src/types/database.ts

UPDATED SOURCE
--------------
src/lib/supabase.ts is now typed with Database.
src/types/profile.ts now derives Profile from Database.

STEP 1 — DATABASE MIGRATION
---------------------------
If Phase 5 SQL has not been run yet, run it first.

Supabase Dashboard -> SQL Editor -> New query
Open and copy ALL of:

supabase/migrations/202608150003_phase6_messaging_schema.sql

Paste -> Run.

STEP 2 — VERIFY DATABASE
------------------------
Open:

supabase/phase6_verify.sql

Paste into a new Supabase SQL query and Run.

Expected Phase 6 tables:
- conversations
- conversation_members
- messages
- message_receipts
- attachments

All five must show RLS enabled.

STEP 3 — TYPESCRIPT
-------------------
No new npm dependency and no native Android rebuild is required for Phase 6.
On your existing project run:

npm run typecheck

If Expo typed-route definitions are stale, start Expo first:

npx expo start -c

then run typecheck in a second terminal.

STEP 4 — REGRESSION TEST
------------------------
Launch PulseChat and verify:
- session restore
- profile load/edit
- avatar
- sign out
- sign in

Chats remain mock data in Phase 6. That is expected.

GIT CHECKPOINT
--------------
git add .
git status
git commit -m "feat: add production messaging database schema"

NEXT
----
Phase 7: controlled user discovery/search.

PulseChat — Phase 7: User Discovery
===================================

PREREQUISITES
- Phases 1–6 already working.
- Phase 6 migration already executed.
- At least two PulseChat accounts are recommended for testing.

1) COPY PACKAGE
Copy the contents of this PulseChat folder over your existing project.
Keep your local .env, .git, android, node_modules, .idea and .expo folders.

2) NPM / NATIVE BUILD
No new npm or native dependencies are added in Phase 7.
Do not run expo prebuild just for this phase.

3) RUN DATABASE MIGRATION
Supabase Dashboard -> SQL Editor -> New query.
Paste and run:
  supabase/migrations/202608150004_phase7_user_discovery.sql

4) VERIFY DATABASE
Run:
  supabase/phase7_verify.sql

Expected:
- search_profiles function exists and is security definer
- get_public_profile function exists and is security definer
- two profile search indexes exist
- profiles RLS remains enabled
- no broad profile SELECT policy was added

5) REGENERATE EXPO TYPED ROUTES
Phase 7 adds /users/[userId]. Start Expo once:
  npx expo start -c

After Metro starts, press a or leave Metro running.

6) TYPECHECK
In another Android Studio terminal:
  npm run typecheck

Expected: zero TypeScript errors.

7) TEST REAL DISCOVERY
- Sign in as Account A.
- Ensure Account B has a recognizable display name/username.
- Search with 2+ characters from B's name or username.
- Open B's result.
- Verify public profile page shows name/username/bio/avatar.
- Verify no email is displayed.
- Verify Start chat is disabled for Phase 8.
- Verify Account A never appears in its own search results.

8) FAILURE TEST
Disable network and search. The app should show Search unavailable + Try again.
Search a random string. The app should show No people found.

9) GIT CHECKPOINT
  git add .
  git status
  git commit -m "feat: add secure user discovery"

NEXT
Phase 8 — transactional direct-chat creation + real database-backed chat list.

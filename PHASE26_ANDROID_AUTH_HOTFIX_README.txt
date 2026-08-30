PulseChat Phase 26 — Android authentication/runtime hotfix
==========================================================

Observed device failure
-----------------------
The signed preview APK accepted login and rendered authenticated routes, but
Android REST/RPC requests fell back to the publishable/anonymous API identity.
Supabase therefore rejected every authenticated function even though the live
database functions and authenticated grants were correct. A failed push-token
registration also caused repeated native token-change retries.

Fixes
-----
- Mirrors the current native access token in memory and applies it only when a
  Supabase REST/Storage/Functions request is missing a real session header.
- Never applies the fallback to Supabase Auth endpoints, foreign origins, Web,
  logs, storage, or diagnostics content.
- Verifies restored Android sessions and explicitly mirrors fresh sign-in and
  sign-up sessions before authenticated screens issue their first request.
- Single-flights push registration, bounds Expo token acquisition to 15
  seconds, and ignores duplicate native-token events to prevent retry storms.
- Keeps Android permission status visible even when backend registration status
  cannot be loaded.
- Replaces the stale Phase 23 Settings caption with the real V1 version/build.
- Shows a safe session-specific recovery message instead of mislabelling an
  authorization failure as a connectivity failure.

Verification
------------
- npm run typecheck: passed
- npm run lint: passed
- npm run test:unit: 34/34 passed
- npm run secrets:check: passed
- npm run qa:phase26: passed with the existing source-only owner warnings
- Android and Web Expo exports: passed

Owner rebuild
-------------
1. Copy the hotfix files over the Phase 26 repository.
2. Run: npm run qa:phase26
3. Commit and push the changes.
4. Run: npm run build:android:preview
5. Install the new APK, sign in, and test Chats, Search, Privacy, local
   notification permission, and push registration in that order.

Recommended commit
------------------
fix(android): preserve authenticated sessions and bound push registration

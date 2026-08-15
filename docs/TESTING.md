# PulseChat Testing

## Phase 7 migration verification
After running `202608150004_phase7_user_discovery.sql`, run `supabase/phase7_verify.sql`.

Verify:
- `search_profiles` exists and is `SECURITY DEFINER`
- `get_public_profile` exists and is `SECURITY DEFINER`
- both trigram indexes exist
- `public.profiles` still has RLS enabled
- no broad authenticated SELECT policy was added to profiles
- discovery function EXECUTE is available to authenticated but not anon

## Application test — two accounts
Use two real accounts, A and B.

1. Account B sets a display name, username, bio and optional avatar.
2. Account A opens Search.
3. Enter fewer than 2 characters: no network search/results should run.
4. Search for part of B's display name.
5. Search for part of B's username.
6. B appears with avatar/name/username/bio preview.
7. A must never appear in A's own results.
8. Tap B: the public-profile route opens and shows only safe public fields.
9. `Start chat` is disabled and clearly marked for Phase 8.
10. Sign out and verify protected routes still return to Login.

## Failure-path tests
- Turn off networking, search, and confirm a retry state is shown.
- Search a random string and confirm the no-results state.
- Navigate to a non-existent user UUID and confirm Profile unavailable.
- Type quickly (`pr`, `pra`, `prak`): an older request must not overwrite a newer query's results.

## Privacy/security tests
- With an authenticated client, a direct `.from('profiles').select('*')` must still return only the caller's own row because existing RLS remains self-only.
- An unauthenticated/anon call to `search_profiles` must not execute.
- Search responses must contain no email/auth metadata.
- A query containing `%` or `_` must be treated as literal search text rather than a match-all wildcard.

## Regression
Authentication, profile editing, avatars, sign-out and Phase 6 schema behavior must remain unchanged.

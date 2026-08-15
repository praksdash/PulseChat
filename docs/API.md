# PulseChat API / Data Access

## Phase 4
The client accesses Supabase directly through `@supabase/supabase-js` using the publishable key and the signed-in user's JWT.

### Auth operations
- `supabase.auth.signUp`
- `supabase.auth.signInWithPassword`
- `supabase.auth.getSession`
- `supabase.auth.onAuthStateChange`
- `supabase.auth.signOut`

### Profile operation
- SELECT own row from `public.profiles`

There is no custom REST API or Edge Function in Phase 4.

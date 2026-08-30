PulseChat Phase 27.3 — secure server-side call-token generation
================================================================

Outcome
-------
Adds one authenticated Supabase Edge Function that returns a two-minute,
room-scoped LiveKit token for an authorized Phase 27.2 call party.

No Android calling SDK, permission, call screen, outgoing flow, or incoming
ringing behavior is added in this phase.

Required private Supabase secrets
---------------------------------
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET

Use the LiveKit project's wss:// URL. Configure all three only in Supabase Edge
Function secrets. Never paste their values into source, .env, EAS client
variables, screenshots, Git, or support messages.

Deploy
------
From an authenticated Supabase CLI linked to the PulseChat project:
  npx supabase functions deploy issue-call-token --no-verify-jwt

Or deploy the folder from the Supabase Dashboard and keep gateway JWT
verification disabled; the function performs strict Supabase getUser
validation itself.

Local verification
------------------
  npm run typecheck
  npm run lint
  npm run test:unit
  npm run secrets:check
  npm run release:audit:source

Expected unit result after this package: 46 tests, 46 passed, 0 failed.

Live acceptance
---------------
1. Invoke without an Authorization bearer token: expect HTTP 401.
2. Use an authenticated account that is not a call party: expect no token.
3. A call party can receive a token only in its allowed call state.
4. Never copy a returned token into Git, screenshots, or chat.

Recommended commit
------------------
feat(calls): add secure Phase 27.3 LiveKit token issuer


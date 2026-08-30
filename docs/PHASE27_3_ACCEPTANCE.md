# PulseChat Phase 27.3 — secure call-token generation acceptance

Status: **SOURCE COMPLETE — OWNER SECRET/DEPLOYMENT VERIFICATION REQUIRED**

## Objective

Create one Supabase Edge Function that issues a short-lived, room-scoped
LiveKit join token only to an authenticated party of an existing Phase 27.2
call session.

## Files changed

- `supabase/functions/_shared/livekit-token.mjs`
- `supabase/functions/issue-call-token/index.ts`
- `supabase/config.toml`
- `tests/phase27-3-call-token.test.mjs`
- `docs/PHASE27_3_ACCEPTANCE.md`
- `docs/ROADMAP.md`
- `PHASE27_3_README.txt`

No app source, dependency, lockfile, Android permission, screen, Firebase
setting, package identity, or database table is changed.

## Authorization contract

The endpoint accepts only `POST` with JSON:

```json
{ "callSessionId": "927389ec-de01-40c9-8eaf-a33f67161ab8" }
```

It validates the bearer token with Supabase Auth and queries `call_sessions`
using that same user's RLS-bound client. It never uses a service-role client.

- Caller: may receive a token while an unexpired call is `ringing`, or while it
  is `accepted`/`active`.
- Callee: may receive a token only after the session is `accepted`/`active`.
- Everyone else and RLS-hidden sessions: no token.
- Terminal or expired-ringing sessions: no token.

## Token contract

- HS256 signed with the server-only LiveKit API secret.
- Subject is the authenticated Supabase user UUID.
- Room is deterministically restricted to `pulsechat-call-<call UUID>`.
- Lifetime is 120 seconds, with a unique token ID.
- Voice calls may publish microphone only.
- Video calls may publish microphone and camera only.
- Subscription is allowed; data publication, recording, room administration,
  and wildcard room access are not granted.
- Responses use `Cache-Control: no-store`.

The token expiry limits how long a credential can be used to join/rejoin; it
does not disconnect an already connected participant at 120 seconds.

## Required server-only secrets

- `LIVEKIT_URL` — exact `wss://` project URL.
- `LIVEKIT_API_KEY` — LiveKit project API key.
- `LIVEKIT_API_SECRET` — matching API secret, at least 32 characters.

These belong in Supabase Edge Function secrets only. Never place them in the
React Native `.env`, an `EXPO_PUBLIC_*` variable, EAS client variables, source,
logs, screenshots, or chat messages.

## Acceptance criteria

- [x] token signer produces verified HS256 JWTs;
- [x] token TTL is bounded to 30–300 seconds and endpoint uses 120 seconds;
- [x] room, participant identity, and publish sources are scoped;
- [x] endpoint validates Supabase authentication;
- [x] authorization query uses the user's RLS-bound client;
- [x] endpoint contains no service-role access;
- [x] terminal/expired/unauthorized calls cannot receive a token;
- [x] secret scan and source regressions pass;
- [ ] LiveKit development project is created by the owner;
- [ ] all three secrets are configured privately in Supabase;
- [ ] `issue-call-token` is deployed;
- [ ] unauthenticated invocation returns HTTP 401;
- [ ] an authenticated non-party receives no token; and
- [ ] the owner approves Phase 27.3 before Phase 27.4 begins.

Phase 27.3 does not claim successful media connection. That begins only after
the Android SDK/permission integration in Phase 27.4.


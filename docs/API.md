# PulseChat API / Service Boundary

## Current status
Phase 3 has no remote API calls.

## Planned boundaries
- Supabase Auth for authentication/session operations.
- PostgreSQL through Supabase for persistent application data.
- Supabase Realtime for live messaging/presence events.
- Supabase Storage for private media.
- Edge Functions only for trusted server-side operations such as notification fan-out when required.

UI components in `src/components/ui` must remain independent of Supabase so they can be reused and tested without backend coupling.

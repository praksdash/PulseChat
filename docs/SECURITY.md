# PulseChat Security

## Current phase
No backend or user authentication is connected in Phase 3, so no secrets should exist in the mobile source code yet.

## Non-negotiable rules for upcoming phases
- Never place a Supabase service-role or secret key in the Expo application.
- Treat mobile clients as untrusted.
- Enforce conversation and message authorization with PostgreSQL Row-Level Security.
- Keep private chat media in non-public storage and authorize access server-side/RLS-side.
- Validate group administration and account mutation permissions at the data layer.
- Store only client-safe public/publishable configuration in the app.

## Phase 3 security surface
The current screens contain static/local prototype data only. Login and registration inputs are not submitted or persisted.

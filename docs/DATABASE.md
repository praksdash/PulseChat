# PulseChat Database

## Current tables

### `public.profiles`
Created in Phase 4 and expanded in Phase 5.

- `id uuid` — PK/FK to `auth.users(id)`, cascade delete
- `display_name text` — required, trimmed length 2–60
- `username text` — optional, globally unique, lowercase `a-z0-9_`, length 3–32
- `avatar_path text` — optional object path; constrained to begin with the profile owner's UUID
- `bio text` — optional, max 160 characters
- `created_at timestamptz`
- `updated_at timestamptz`

The Phase 4 auth trigger creates the row. The authenticated app can only SELECT/UPDATE its own row at this phase.

## Phase 5 RPC

### `public.is_username_available(candidate text)`
Security-definer function callable only by authenticated users. It returns availability without granting general profile-table SELECT access before Phase 7 user discovery.

## Storage

### `avatars` bucket
- Public read by URL: intentional because profile pictures become discoverable identity data.
- 5 MB object limit.
- MIME types: JPEG, PNG, WEBP.
- App uploads a compressed 512×512 JPEG.
- INSERT/UPDATE/DELETE policies require the first path folder to equal `auth.uid()`.
- Expected path: `<user_uuid>/avatar-<timestamp>.jpg`.

## Next database phase
Phase 6 adds conversations, conversation members, messages, receipts and the indexes/RLS required for messaging.

# PulseChat Database

## Phase 4 table: `public.profiles`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, FK to `auth.users(id)`, cascade delete |
| display_name | text | Required, 2–60 chars |
| username | text | Nullable until Phase 5; unique; lowercase pattern when present |
| avatar_path | text | Nullable; used later with Storage |
| bio | text | Nullable |
| created_at | timestamptz | UTC default |
| updated_at | timestamptz | Updated by trigger |

## RLS in Phase 4
Authenticated users can select and update only the row whose `id = auth.uid()`.

Direct client insert/delete is not granted. A security-definer trigger creates the profile after a new `auth.users` record is inserted.

User discovery is intentionally postponed to Phase 7 rather than making all profiles publicly readable now.

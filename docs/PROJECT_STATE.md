# PulseChat Project State

## Current phase
Phase 5 — User Profile

## Completed
- Phase 1 development environment and Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system and polished messenger UI
- Phase 4 Supabase email/password authentication, persisted sessions, protected routes, profile trigger/RLS and working local sign-out
- Phase 5 editable profile implementation in source

## Phase 5 working target
- Edit display name
- Optional unique username (`a-z`, `0-9`, `_`, 3–32 chars)
- Username availability check through a narrow security-definer RPC
- Bio up to 160 characters
- Avatar selection/crop from the device photo library
- 512×512 JPEG compression before upload
- Public `avatars` bucket for profile-picture delivery
- Storage RLS restricting create/update/delete to each user's UUID folder
- Replace/remove avatar with old-object cleanup
- Profile screen renders real avatar, username and bio

## Developer verification required
1. Run `supabase/migrations/202608150002_phase5_profiles_avatars.sql` in Supabase SQL Editor.
2. Install Phase 5 packages with `npm install`.
3. Rebuild native directories/client because ImagePicker/ImageManipulator are native dependencies.
4. Verify profile edit, username collision, avatar upload/remove and app restart on Android.

## Intentionally not implemented yet
- Conversation/message database schema (Phase 6)
- Global user search/discovery (Phase 7)
- Chat creation and realtime messaging
- Message/media attachments inside chats
- Push notifications

## Known bugs
None known in Phase 5 source. Runtime verification against the developer's Supabase project is required.

## Database migrations
- `202608150001_phase4_auth_profiles.sql` — completed by developer
- `202608150002_phase5_profiles_avatars.sql` — run for Phase 5

## Environment variables
Required locally in `.env` (never commit):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add editable user profiles and avatars`

## Next task
Phase 6 — production messaging database architecture and RLS foundation.

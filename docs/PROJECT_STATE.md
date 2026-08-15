# PulseChat Project State

## Current phase
Phase 12 — Image media messaging

## Completed
- Phase 1 development environment + Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system
- Phase 4 Supabase authentication + persisted sessions
- Phase 5 editable profiles/usernames/bios/avatars
- Phase 6 production messaging schema + RLS
- Phase 7 secure user discovery
- Phase 8 transactional direct-chat creation + real Chats list
- Phase 9 durable realtime one-to-one text messaging
- Phase 10 delivered/read receipts + unread counters
- Phase 11 typing indicators + online/offline presence + last seen
- Phase 12 private image media messaging packaged + image RPC/Presence lifecycle hotfix

## Phase 12 implementation
- private `chat-media` Supabase Storage bucket
- 10 MB Storage object limit; Phase 12 client writes JPEG only
- canonical `conversation_uuid/uploader_uuid/client_message_uuid.jpg` object path
- Storage RLS based on actual conversation membership
- uploader-only writes/deletes within the uploader folder
- direct client message INSERT policy tightened to text only
- idempotent `create_image_message` RPC creates image message + attachment metadata atomically on the DB side
- hotfix uses the named `messages_sender_client_unique` constraint to avoid PL/pgSQL `sender_id` ambiguity
- image attachment projection added to `list_conversation_messages`
- private signed URLs generated only after message/RLS access
- images resized to max 1600px and compressed to JPEG before upload
- gallery picker + Android/iOS camera capture
- optimistic local photo bubble
- preparing/uploading/committing/failure states
- retry reuses the same client message ID and canonical Storage path
- `media_message_ready` private Broadcast reconciles attachment metadata after message INSERT
- image bubbles retain delivered/read ticks
- full-screen image viewer

## Developer verification required
1. Ensure migrations through Phase 11 are applied.
2. Run `202608150009_phase12_image_media.sql` for a fresh install, or `202608150010_phase12_hotfix.sql` if Phase 12 was already applied.
3. Run `supabase/phase12_verify.sql`.
4. Run `npx expo prebuild --clean` because camera permission config changed.
5. Run `npx expo run:android` once with an emulator/device connected.
6. Run `npx expo start -c` for normal development.
7. Run `npm run typecheck`.
8. A sends gallery photo; B sees it without refresh.
9. B opens it full-screen; A receives delivered/read ticks as before.
10. Restart both clients; the private image must reload from Storage history.
11. Disconnect network, send image, reconnect and tap retry; no duplicate message/object should appear.
12. Verify Account C cannot create a signed URL/download an A-B media object through normal authenticated Storage access.

## Intentionally not implemented yet
- reply/edit/delete/reactions (Phase 13)
- group chats (Phase 14)
- push notifications (Phase 15)
- generic document/video/audio/voice-note composer UI (media schema is already ready)

## Known limitations
- Failed image sends are retryable while the current app session still has the local image URI. Persisting an offline media queue across process restarts belongs to Phase 19.
- Signed media URLs are temporary and regenerated when history is fetched/reconciled.
- If Storage succeeds but a non-retryable database error occurs, an orphan Storage object can remain; production cleanup/hardening belongs to Phase 21.
- Phase 12 proves the image pipeline first. Video/audio/document UI will reuse the same private bucket + attachment model later.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`
- `202608150004_phase7_user_discovery.sql`
- `202608150005_phase8_direct_chat_creation.sql`
- `202608150006_phase9_realtime_text_messaging.sql`
- `202608150007_phase10_delivery_read_unread.sql`
- `202608150008_phase11_typing_presence.sql`
- `202608150009_phase12_image_media.sql`
- `202608150010_phase12_hotfix.sql`

## Environment variables
Local `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add secure image media messaging`

## Next task
Phase 13 — reply/edit/delete/reactions.

PulseChat Phase 12 — Image Media Messaging

What this phase adds
- choose a chat image from the device photo library
- take a photo in Android/iOS
- resize large images to max 1600px while preserving aspect ratio
- JPEG compression before upload
- private Supabase Storage bucket: chat-media
- canonical object path: conversation/user/client-message.jpg
- Storage RLS: conversation members can read; uploader can write/delete own objects
- idempotent create_image_message RPC
- attachment metadata in public.attachments
- optimistic local image preview
- preparing/uploading/sending states
- failed photo retry using the same client_message_id + storage path
- private signed media URLs
- realtime media_message_ready reconciliation
- image bubbles with delivered/read ticks
- full-screen photo viewer
- existing pagination/reconnect flow also hydrates media URLs

Required steps
1. Copy this package over the existing Phase 11 project, keeping .env/.git/local machine folders.
2. Run supabase/migrations/202608150009_phase12_image_media.sql in Supabase SQL Editor.
3. Run supabase/phase12_verify.sql.
4. Because camera permission configuration changed, run `npx expo prebuild --clean` and then `npx expo run:android` once.
5. Start normal development with `npx expo start -c`.
6. Run `npm run typecheck`.
7. Test library photo, camera photo, realtime receipt, restart/history, full-screen view and failed-send retry.

Scope note
Phase 12 implements the prototype-critical image media path. Generic documents, video, audio and voice-note UI are intentionally deferred until after the image path is proven; the Phase 6 schema already has types/metadata columns for them.


Phase 12 hotfix (apply if the first Phase 12 package was already installed)
- fixes create_image_message: column reference "sender_id" is ambiguous
- fixes React development remounts reusing an already-subscribed Presence channel
- run supabase/migrations/202608150010_phase12_hotfix.sql once
- no native rebuild is required for the hotfix itself

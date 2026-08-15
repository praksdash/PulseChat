PulseChat Phase 13 — Reply / Edit / Delete / Emoji Reactions
============================================================

Run after Phase 12 is confirmed working.

1. Copy this package over the existing PulseChat source project.
2. Keep your local .env, .git, .idea, android, node_modules and package-lock.json.
3. No npm/native dependency was added in Phase 13.
4. Run the SQL migration in Supabase SQL Editor:
   supabase/migrations/202608150011_phase13_message_actions.sql
5. Run verification:
   supabase/phase13_verify.sql
6. Start Expo:
   npx expo start -c
7. Run in another terminal:
   npm run typecheck

How to use
----------
Long-press a delivered message to open actions.

Reply:
- Any non-deleted persisted message can be replied to.
- The composer shows the reply target.
- Text and photo sends can both carry a reply target.

Edit:
- Only your own text messages / photo captions can be edited.
- Editing is server-authorized using auth.uid().
- The message displays an "edited" marker after saving.

Delete:
- Only your own persisted messages can be deleted for everyone.
- Delete is a soft-delete for durable timeline consistency.
- Body and attachment metadata are redacted.
- Image object cleanup is attempted through Supabase Storage.
- Storage RLS prevents newly signing media whose message/attachment was deleted.

Reactions:
- Supported set: 👍 ❤️ 😂 😮 😢 🙏
- One active reaction per user per message in the MVP.
- Tapping your current reaction removes it; choosing another replaces it.

Realtime events
---------------
conversation:<uuid>
- message_updated
- message_deleted
- message_reactions_changed

user:<uuid>
- inbox_message_changed (edit/delete refreshes Chats preview)

Phase 13 intentionally does not add groups. Group messaging is Phase 14.

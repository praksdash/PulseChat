PulseChat Phase 14 — Group Chats

1. Copy this package over the existing Phase 13 project. Keep local .env, .git, .idea, android, node_modules and package-lock.json.
2. Run the SQL migration:
   supabase/migrations/202608150012_phase14_group_chats.sql
3. Run verification:
   supabase/phase14_verify.sql
4. Start Expo once with a clean cache so typed routes include /groups/new and /groups/[conversationId]:
   npx expo start -c
5. In another terminal run:
   npm run typecheck
6. Test group creation with at least 3 accounts when possible.

Phase 14 features:
- create named group from secure profile search
- optional group avatar
- owner/admin/member roles
- add/remove members
- promote/demote admins
- transfer ownership
- non-owner leave group
- group rows in Chats with unread counts
- sender name/avatar in incoming group messages
- existing text/image/reply/edit/delete/reaction flow in groups
- group-compatible sent/delivered/read aggregate receipts

No new npm/native package is introduced by Phase 14.

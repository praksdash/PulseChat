PulseChat Phase 8 — Direct Chat Creation + Real Chat List

WHAT CHANGED
- Start Chat on a discovered user's profile is now real.
- A database RPC creates or returns exactly one direct conversation for a user pair.
- Concurrent Start Chat attempts are protected by the existing unique direct_key index.
- The Chats tab now loads actual Supabase conversations instead of demo rows.
- Chat-list search filters the signed-in user's loaded conversations by name/username.
- Pull-to-refresh and focus refresh are enabled.
- Empty/loading/error states are included.
- Opening a conversation loads a membership-protected conversation summary from Supabase.
- Message sending remains intentionally disabled until Phase 9.

INSTALL
1. Copy this package over the existing PulseChat project without deleting .env or .git.
2. Run supabase/migrations/202608150005_phase8_direct_chat_creation.sql in Supabase SQL Editor.
3. Run supabase/phase8_verify.sql.
4. Start Expo with: npx expo start -c
5. In another terminal run: npm run typecheck
6. Test with two real accounts.

TEST
Account A:
- Search for Account B.
- Open B's profile.
- Tap Start chat.
- A real conversation opens.
- Go back to Chats; B appears in the real conversation list.
- Return to B and tap Start chat again; the same conversation must reopen.

Account B:
- Open Chats or pull to refresh.
- The same conversation should appear.

EXPECTED DATABASE STATE
- One row in public.conversations for the pair.
- Exactly two rows in public.conversation_members for that conversation.
- Repeated Start Chat calls must NOT create duplicate conversation rows.

NOT YET IMPLEMENTED
- Sending text messages (Phase 9)
- Realtime Broadcast (Phase 9)
- Delivered/read states (Phase 10)
- Typing/presence (Phase 11)

# PulseChat Architecture

## Current application architecture

```text
Expo / React Native / TypeScript
        │
        ├── Expo Router
        ├── AuthProvider
        ├── UI/theme
        ├── profile/discovery services
        ├── conversation service
        ├── message + receipt services
        ├── authenticated inbox Realtime service
        └── typed Supabase client
                 │
                 ├── Supabase Auth
                 ├── PostgreSQL + RLS
                 │      ├── profiles/discovery
                 │      ├── conversations/members
                 │      ├── durable messages
                 │      └── per-recipient receipts
                 ├── Supabase Realtime Broadcast
                 │      ├── conversation:<uuid>
                 │      └── user:<uuid>
                 ├── Supabase Storage
                 │      ├── avatars / group-avatars
                 │      └── private chat-media
                 └── Supabase Edge Functions
                        └── send-message-push → Expo Push Service → FCM/APNs
```

## Phase 10 message lifecycle

```text
A taps Send
   ↓
optimistic message
   ↓
INSERT public.messages
   ↓
receipt trigger creates B receipt (null/null)
   ↓
commit
   ├── conversation:<uuid> INSERT broadcast
   └── user:<B uuid> inbox_message broadcast
                         ↓
                     B app connected
                         ↓
               mark_conversation_delivered
                         ↓
                receipt.delivered_at
                         ↓
        conversation:<uuid> receipt_delivered
                         ↓
                    A shows ✓✓

B opens chat while app active
   ↓
mark_conversation_read
   ↓
receipt.read_at + member.last_read_at
   ↓
conversation:<uuid> receipt_read
   ↓
A shows read-colored ✓✓
```

## Source of truth
PostgreSQL remains authoritative for both message content and receipt state. Realtime events are hints for low-latency UI updates. Message/history refetches restore state after reconnect or app restart.

## Inbox topic
`user:<auth uid>` is a private database-Broadcast topic. Only that authenticated user may subscribe. It contains only minimal message identifiers/timestamps, not another user's private profile/auth data.

## Conversation topic
`conversation:<conversation uuid>` remains private and membership-authorized. It carries committed message inserts plus receipt cursor events.

## Receipt cursor events
Receipt updates are broadcast as a monotonic `through_created_at` cursor instead of one WebSocket event per message. The client updates visible ticks immediately and then reconciles latest PostgreSQL state.

## Unread state
`message_receipts.read_at IS NULL` is the authoritative unread source. `conversation_members.last_read_at` is also maintained as a useful conversation read cursor for later query/UX features.

## Deferred
- calls, secret-chat E2EE, stories, bots, channels, desktop and multi-device clients
- expanded audio/video/voice/file messaging
- chat-list cursor pagination beyond the V1 50-conversation cap
- Phase 21 security review after V1 device acceptance
- Phase 26: asynchronous Expo push-receipt polling/monitoring

## Phase 12 image send flow

```text
pick/capture image
      ↓
resize to max 1600px + JPEG compress
      ↓
optimistic local photo bubble
      ↓
private Storage upload
conversation/user/client-message.jpg
      ↓
create_image_message RPC
      ├─ durable messages row
      └─ attachments metadata row
      ↓
media_message_ready private Broadcast
      ↓
peer reconciles message history
      ↓
Storage SELECT RLS + temporary signed URL
      ↓
image bubble / full-screen viewer
```

The Storage bucket is private. PostgreSQL remains the source of truth for message/attachment metadata; Storage owns the binary object; Realtime only accelerates reconciliation.

## Phase 13 message mutation flow

```text
Long-press message
      ↓
Reply / Edit / Delete / React
      ↓
PostgreSQL validates auth.uid(), ownership and membership
      ↓
Durable mutation
      ↓
private conversation:<uuid> Broadcast
      ↓
peer fetches get_message_detail(message_id)
      ↓
visible bubble reconciles without full-history reload
```

Edit/delete also fan out a minimal `inbox_message_changed` event to private `user:<uuid>` topics so the Chats preview refreshes when the latest message changes.

Replies use the existing `(reply_to_message_id, conversation_id)` foreign key, guaranteeing that a reply cannot target another conversation.

Deleted image messages remove attachment metadata and are no longer eligible for new Storage signed URLs. Physical object deletion is then attempted by the sender client under uploader-only Storage RLS.

## Phase 14 group architecture

Groups reuse the same durable messaging path as direct chats:

`group creator → create_group_conversation RPC → conversations(kind=group) + conversation_members → private conversation Realtime → messages/receipts/attachments`

Member administration is server-authoritative. The client never inserts/deletes membership rows directly. Group message history uses the same pagination, media, reply/edit/delete/reaction, receipt and Realtime infrastructure as direct chats, with an expanded authorized projection for sender identity.

## Phase 15 push architecture

```text
sender inserts public.messages
        ↓
PostgreSQL commits message + recipient receipts
        ↓
Supabase Database Webhook (INSERT only)
        ↓  x-pulsechat-webhook-secret
send-message-push Edge Function
        ↓
load current conversation members + mute state
        ↓
load enabled public.push_tokens
        ↓
claim_push_deliveries(message, recipients)
        ↓  unique(message_id, expo_push_token)
Expo Push Service
        ↓
FCM / APNs
        ↓
recipient OS notification
        ↓ tap
PulseChat validates current membership
        ↓
/chat/<conversation UUID>
```

The sender never supplies recipient push tokens and the client never receives the server credential. Push is a server-side consequence of a durable message insert. The Database Webhook is protected by `PUSH_WEBHOOK_SECRET`; the Edge Function uses Supabase's server-only service-role environment and an Expo access token.

Foreground delivery deliberately suppresses the OS banner when the user already has that exact conversation focused. Realtime remains responsible for the live in-app message UI; push is the background/terminated transport.

## Phase 18 settings architecture
- `ThemeProvider` owns device-local `system | light | dark` appearance and persists it with AsyncStorage.
- PostgreSQL remains the source of truth for account-wide notification preferences and per-conversation mute state.
- Native remote push preferences are enforced server-side by `send-message-push`.
- Web alerts use the browser Notification API but consume the same account preferences and per-chat mute RPC.
- Destructive account deletion is isolated in a Supabase Edge Function so service-role credentials never enter the Expo bundle.

## Phase 19 offline/resilience architecture

```text
UI action
   ↓
ConnectivityProvider (backend reachability)
   ├─ online → normal Supabase operation
   └─ offline → local cache / durable text outbox
                    ↓
              reconnect detected
                    ↓
           flush with same client_message_id
                    ↓
         PostgreSQL unique deduplication
                    ↓
            authoritative reconciliation
```

Recent conversation lists, summaries and message pages are cached locally after successful reads. Native cache/outbox payloads are AES-encrypted before AsyncStorage persistence, with the encryption key kept in Expo SecureStore. Web follows browser-origin storage semantics.

Text outbox entries are durable across app restarts. Image picker/camera URIs are intentionally session-only because temporary mobile URIs are not reliable across process restarts. Realtime remains an acceleration layer; PostgreSQL remains the source of truth after reconnection.

## Phase 20 performance architecture

Phase 20 adds client-side work coalescing without introducing a second source of truth:

```text
UI / Realtime burst
      ↓
short coalescing + in-flight request dedupe
      ↓
bounded Chats RPC + cursor-paginated message/search RPCs
      ↓
PostgreSQL authoritative state
```

Message/chat FlatLists use bounded render windows, batched cell mounting, stable render callbacks, and correctness-safe memo comparators. Latest-message reconciliation is keyed by user + conversation and applies only when the route is still current. Chats and summaries use request sequence guards so slow responses cannot replace newer state.

Private media signing uses batch requests, per-path in-flight deduplication, and a bounded in-memory cache whose TTL is shorter than the one-hour signed URL lifetime. Authentication changes invalidate the cache. Phase 19 encrypted offline writes are serialized per key and skip identical payloads so reconnect/focus reconciliation neither writes stale snapshots out of order nor repeats encryption/storage work.

No Phase 20 optimization bypasses RLS, durable message persistence, receipts, privacy rules or retry idempotency.

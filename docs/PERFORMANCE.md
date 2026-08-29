# PulseChat performance strategy

## Phase 20 V1 goal

Optimize the two-device Prototype V1 hot paths without creating a second source of truth. PostgreSQL remains authoritative, Supabase Realtime only accelerates updates, and every optimization preserves RLS, membership checks, receipts, and `client_message_id` retry deduplication.

## Rendering budgets

- Chats: 14 initial rows, batches of 10, window size 7.
- Messages: 24 initial rows, batches of 12, window size 9.
- Native lists clip off-screen rows where the platform is reliable; web clipping remains disabled.
- Chat rows, avatars, text bubbles, and media bubbles are memoized.
- The message render callback is stable across composer keystrokes and unrelated screen state.
- Bubble comparators include interaction callbacks; an online/offline transition cannot leave Retry or React bound to stale state.
- `expo-image` uses memory/disk caching and a URI recycling key for virtualized avatars/media.

## Network ordering and coalescing

Each active-chat latest refresh is keyed by authenticated user and conversation. If receipt, reconnect, foreground, and Realtime events arrive together:

1. one request runs;
2. additional same-key requests collapse into one trailing run;
3. the newest trailing task is used; and
4. another conversation uses a different key and proceeds independently.

Responses also carry current-screen guards. Old chat-list, summary, page, or message-detail responses are ignored after a newer request or route change, preventing slow requests from overwriting newer UI state.

Conversation activity broadcasts are coalesced over a short window before Chats/unread refreshes. Durable message delivery is never delayed by that timer.

## Pagination boundary

- Message history uses the existing `(created_at, id)` cursor RPC and loads 30 messages per page.
- The Prototype V1 Chats list is capped at 50 conversations by the existing RPC. This is sufficient for the stated V1 test and is documented honestly; cursor pagination for hundreds of chats is a later product-scale task.
- Search already uses its own limits/cursors.

## Private media URLs

- Signed URLs live only in process memory and expire from the client cache after 50 minutes, below the one-hour server lifetime.
- Missing paths are batch-signed.
- Concurrent requests for the same path share one in-flight promise.
- The cache is bounded to 300 paths and refreshed as an LRU-style map.
- Cache generation and all entries are cleared when the authenticated account changes, so a signed URL cannot be reused by a later account in the same app process.
- Phase 21 strips signed URLs before offline message snapshots are written. Cached rows retain only the durable private object path and must be re-authorized online for a fresh URL.

## Offline cache writes

- Recent chat lists, summaries, and message pages use the Phase 21 authenticated AES-256-GCM envelope; readable Phase 19 values are upgraded on first access.
- Each key has a serialized write queue, preventing an older slow write from finishing after a newer snapshot.
- A byte-identical serialized payload is not encrypted/written twice in the same process.
- Fingerprints and pending writes are bounded/cleared with the user cache.
- AsyncStorage v3 uses `removeMany` for batch removal.

## Correctness constraints

Phase 20 must preserve:

- conversation/group membership authorization and RLS;
- optimistic text/image behavior and duplicate prevention;
- sender/reply/reaction projections;
- sent/delivered/read transitions and unread counts;
- offline outbox replay;
- push, mute, privacy, block, and report behavior;
- theme changes and accessible interactions; and
- app restart persistence.

## Verification budget

Automated local checks cover TypeScript, ESLint, coalescer concurrency semantics, and Android Metro export. Physical-device profiling should use a V1-sized dataset: 20+ chats, 100+ messages in one chat, a media-heavy chat, burst delivery, offline/reconnect, and account switching.

Startup telemetry, API latency dashboards, crash reporting, push-receipt polling, and production alerts remain Phase 26 work.

## Phase 22 correctness follow-up

- Older-page, search-window, Realtime, outbox, and send callbacks now verify the
  active user/conversation scope before changing the timeline.
- Route changes reset loading/search/error state, so an ignored stale request
  cannot leave the next chat with an old spinner or error.
- The Chats tab applies only the newest unread-count response.
- Search pagination is request-sequenced; an old query cannot append results to
  the current query.
- These guards preserve durable sends and retry idempotency. They limit only
  stale UI application, not server persistence.

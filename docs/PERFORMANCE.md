# PulseChat performance strategy

## Phase 20 goals
PulseChat optimizes the early-product hot paths without introducing premature Telegram-scale infrastructure. PostgreSQL remains the source of truth, Supabase Realtime remains an acceleration layer, and client optimizations must never weaken RLS or correctness.

## Rendering budgets
- Chats: render 14 rows initially, then batches of 10 with a 7-window virtualization budget.
- Messages: render 24 rows initially, then batches of 12 with a 9-window virtualization budget.
- Android enables clipped off-screen rows; web keeps clipping disabled to avoid DOM/measurement edge cases.
- Chat rows, avatars and message bubbles are memoized around visual/state props.

## Network request coalescing
The active conversation coalesces overlapping latest-page reconciliation requests caused by receipt, reconnect and foreground events. If another refresh is requested while one is running, PulseChat records a trailing refresh instead of dropping the request. This reduces duplicate work without risking a stale final state.

## Realtime burst behavior
Conversation activity notifications are coalesced over a short window before the Chats list is refreshed. The durable message itself is not delayed; only redundant list-summary refresh work is combined.

## Media URL strategy
Private Storage media continues to use signed URLs. A signed URL is kept only in process memory and reused for 50 minutes, below the one-hour server expiry. Missing URLs are created in a single Storage batch request. No signed URL is persisted by Phase 20.

## Offline cache write strategy
Phase 19 encrypted native caches remain unchanged semantically. Phase 20 fingerprints the plain serialized payload in process memory and skips a write when the payload is byte-identical to the most recently written value for that cache key. This avoids unnecessary AES encryption and AsyncStorage writes.

## Correctness constraints
Performance work must preserve:
- RLS and membership authorization
- client_message_id retry deduplication
- group sender/reply/reaction metadata
- message status transitions
- offline outbox semantics
- push/mute/privacy behavior
- theme updates

## Future profiling
Phase 26 production hardening can add telemetry for startup time, JS exceptions, API latency and push delivery. Phase 20 deliberately avoids adding a paid observability dependency.

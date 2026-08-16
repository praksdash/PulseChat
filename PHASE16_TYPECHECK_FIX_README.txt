PulseChat Phase 16 TypeScript cleanup hotfix

Fixes React useEffect destructor typing in:
- src/services/group-membership-events.ts
- src/services/inbox-message-events.ts

Cause:
Set.delete() returns boolean. The unsubscribe helpers previously returned that boolean from their cleanup callbacks, while React effects require a cleanup function returning void.

Fix:
Cleanup callbacks now call listeners.delete(listener) inside a block and return no value.

No SQL changes.
No dependency changes.
No native rebuild required.

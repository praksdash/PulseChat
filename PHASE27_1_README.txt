PulseChat Phase 27.1 — one-to-one calling scope/provider decision
================================================================

Outcome
-------
Phase 26 remains the stable baseline. Phase 27.1 makes a documentation decision
only: the first call release is one-to-one Android voice/video calling between
members of an existing direct chat, and LiveKit Cloud is the selected media
provider. Supabase remains authoritative for identity, membership, blocks,
permissions, call state, and history.

In scope
--------
- Android two-phone one-to-one voice calling first
- Incoming/outgoing call lifecycle
- Mute and speaker controls
- One-to-one video and camera switching after voice is stable
- Dedicated later work for background/lock-screen/process-death behavior
- Short-lived, room-scoped server-issued media tokens

Out of scope
------------
- Group calls, PSTN/emergency calls, recording, screen sharing and public links
- iOS, Web, desktop and multi-device handoff
- Captions, transcription, translation and AI summaries
- Any E2EE claim

Files
-----
- docs/PHASE27_1_CALL_SCOPE.md
- docs/ROADMAP.md
- PHASE27_1_README.txt

No app source, dependency, lockfile, migration, Edge Function, permission,
package name, Firebase configuration, Supabase client configuration or secret
is changed by this phase.

Verification
------------
Run:
  npm run typecheck
  npm run lint
  npm run test:unit
  npm run release:audit:source
  npm run ops:audit:source

The source-only operations audit may retain the already documented owner-
evidence warning. Any failure must be fixed before approval.

Approval required before Phase 27.2
-----------------------------------
I approve Android one-to-one voice/video calling for existing direct chats,
using LiveKit Cloud for media and Supabase for authorization and durable call
state, with all excluded items remaining out of scope.

Recommended commit
------------------
docs(calls): define Phase 27.1 scope and select LiveKit

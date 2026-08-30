# PulseChat Phase 27.1 — one-to-one calling decision

Date: 2026-08-30 UTC  
Status: **DECISION COMPLETE — OWNER APPROVAL REQUIRED BEFORE PHASE 27.2**

## One small objective

Define the first Android one-to-one voice/video calling boundary and select the
real-time media provider. This phase changes documentation only. It does not
add a dependency, migration, server secret, permission, screen, or call code.

## Verified Phase 26 baseline

The repository currently provides:

- Supabase email/password authentication, profiles, direct and group chats;
- realtime messages, typing, presence, delivery/read state, and search;
- image messages, reply/edit/delete/reactions, blocking, reporting, and privacy;
- Expo Android push registration and message notification handling;
- offline caches/outbox, Android session hardening, release configuration, and
  metadata-only operational diagnostics; and
- an Android preview APK path using the preserved package name
  `com.prakashdash.pulsechat` and the existing Supabase/Firebase projects.

Voice and video calls are explicitly listed as post-V1 work in the existing
roadmap. There is no WebRTC/calling SDK, call-session schema, call-token Edge
Function, call UI, or call permission configuration in the current source.
Phase 26 therefore remains the stable product and release baseline.

Phase 26 source checks do not replace the still-open owner deployment,
monitoring, backup/restore, and signed-device evidence recorded in
`docs/PHASE26_ACCEPTANCE.md`.

## Product boundary selected for the first calling release

The first calling release is **private one-to-one calling between two existing
members of a direct PulseChat conversation on Android**.

### Included

- Start a voice call from an existing direct conversation.
- Ring the other authenticated conversation member.
- Answer or decline on a second Android phone.
- Mute/unmute the microphone and switch speaker output.
- Add optional camera video and front/rear camera switching after voice calling
  is stable.
- End a call from either phone and reconcile a single final server state.
- Recover from a brief network interruption without creating a second call.
- Support foreground first, then background, lock-screen, and terminated-app
  behavior in its dedicated later micro-phase.
- Store only call metadata needed for authorization, ringing state, abuse
  controls, and history. Live audio/video content is not stored by PulseChat.
- Use the existing Supabase user and direct-conversation identities. A phone
  number is not exposed to the other member.

### Explicitly excluded

- group calls, conference rooms, public call links, or calls outside an
  existing direct conversation;
- PSTN/mobile-number dialing, SMS invitations, or emergency calling;
- recording, voicemail, screen sharing, live streaming, call transfer/hold,
  call waiting, reactions, captions, transcription, translation, or AI
  summaries;
- iOS, Web, desktop, Android Auto, Wear OS, or multi-device answer handoff;
- a claim of end-to-end encryption; and
- replacing Supabase authentication, Firebase configuration, Expo Router, the
  Android package name, or the existing message-notification flow.

For the first family/friends test, each test account has one active Android
phone. Multi-installation ringing and first-answer-wins coordination require a
separate approved scope.

## Provider decision

**Selected provider: LiveKit Cloud, using LiveKit's React Native SDK and
short-lived room tokens issued only by a Supabase Edge Function.**

This selection is for the one-to-one Android prototype. No LiveKit dependency
or credential is added in Phase 27.1.

| Option | Fit for PulseChat | Main trade-off | Decision |
| --- | --- | --- | --- |
| LiveKit Cloud | React Native media SDK, managed media infrastructure, low-level UI control, and a future self-hosting path | PulseChat must build its own call state, ringing, push lifecycle, and UI | **Selected** |
| Stream Video | Managed call product primitives can shorten implementation | More provider-specific product model and greater application lock-in | Not selected |
| Agora | Mature managed RTC and broad device reach | More proprietary integration and operational surface than this prototype needs | Not selected |
| Raw WebRTC/self-built SFU | Maximum protocol control | Signaling, NAT traversal, media servers, scaling, observability, and reliability are too large for the micro-phase plan | Rejected |

### Why LiveKit Cloud is the best first fit

1. PulseChat keeps Supabase as the authority for users, conversation
   membership, blocks, permissions, and durable call state.
2. LiveKit is limited to real-time audio/video transport instead of becoming a
   second user or messaging database.
3. The app can build its own focused calling UI with the existing design
   system rather than adopting a second product UI.
4. Managed infrastructure is appropriate for a small family/friends trial;
   operating a TURN/SFU deployment is outside the current team scope.
5. The architecture leaves a possible self-hosting path if scale, data
   residency, or cost later requires it.

Before a public launch, the owner must separately verify current pricing,
service limits, contractual terms, data-region availability, privacy terms,
and projected usage. Phase 27.1 does not make a cost, residency, uptime, or E2EE
claim.

## Architecture boundary for later micro-phases

- **Supabase PostgreSQL/RLS:** authoritative call session, participant,
  permission, block, rate-limit, and history metadata.
- **Supabase Edge Function:** validates the signed-in user and current direct
  conversation membership, then creates a short-lived LiveKit token restricted
  to one room and one participant identity.
- **LiveKit Cloud:** transports real-time audio/video only.
- **PulseChat Android client:** renders call state and controls and joins only
  with the short-lived token.
- **Firebase/Expo notification path:** wakes or alerts the invited Android
  installation. Background and terminated-app reliability is not claimed until
  Phase 27.9 device acceptance.

LiveKit API keys/secrets must be server-side Supabase secrets. They must never
use an `EXPO_PUBLIC_` name, ship in the APK, enter `.env`, or be committed.

## Risks intentionally deferred to their owning micro-phases

- database races and RLS: Phase 27.2;
- token authorization, expiry, replay resistance, and secret handling: 27.3;
- Expo SDK 57 / React Native 0.86 native compatibility and permissions: 27.4;
- outgoing and incoming state-machine behavior: 27.5–27.7;
- video resource and camera behavior: 27.8;
- Android background, lock-screen, notification, and process-death behavior:
  27.9;
- durable history: 27.10;
- blocks, privacy, abuse prevention, and security audit: 27.11; and
- two-phone/reconnect/release evidence: 27.12.

## Files changed in Phase 27.1

- `docs/PHASE27_1_CALL_SCOPE.md` — scope, provider decision, architecture
  boundary, risks, and acceptance record.
- `docs/ROADMAP.md` — records Phase 27.1 as the approved next micro-phase while
  preserving Phase 26 as the stable baseline.
- `PHASE27_1_README.txt` — concise handoff, verification, next gate, and commit
  message.

No application source, dependency, lockfile, Expo configuration, Android
permission, Supabase migration, Edge Function, or secret changes are allowed in
this phase.

## Acceptance criteria

Phase 27.1 is complete only when:

- [x] the Phase 26 repository state and open owner evidence are acknowledged;
- [x] the first release is limited to authenticated one-to-one Android calls
  inside an existing direct conversation;
- [x] included and excluded behavior is explicit;
- [x] LiveKit Cloud is recorded as the selected media provider;
- [x] Supabase remains the authorization and durable-state authority;
- [x] provider credentials are defined as server-only secrets;
- [x] no app code, database, dependency, native configuration, package name,
  Firebase setting, or Supabase client setting changed;
- [x] focused static/source verification passes; and
- [ ] the owner approves this decision before Phase 27.2 starts.

## Owner approval gate

Approve this exact statement to start Phase 27.2:

> I approve Android one-to-one voice/video calling for existing direct chats,
> using LiveKit Cloud for media and Supabase for authorization and durable call
> state, with all excluded items remaining out of scope.


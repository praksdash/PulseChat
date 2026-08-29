# PulseChat Phase 25 privacy-policy source

Status: **owner review and public HTTPS hosting required**

This document records the product facts that the public privacy page must not
contradict. The deployable template is
`release/play-store/public/privacy-policy.template.html`.

## Scope and controller

The policy covers the PulseChat Prototype V1 Android app and its supporting
Supabase, Expo Push Service and Firebase Cloud Messaging processing. Before
publishing, the owner must insert the real developer/operator name, monitored
support email, effective date and public policy/deletion/support URLs.

## Data handled by V1

- Account: email address, authentication identifiers and session records.
- Profile: display name, optional username, bio and avatar.
- Messaging: direct/group membership, text, image/caption, reply, edit,
  deletion, reaction, delivery/read, mute and timestamps.
- Social/safety: blocks, privacy/notification choices and private reports.
- Activity: last-seen/presence and ephemeral typing events, subject to privacy
  controls.
- Search: a query is sent to the backend to retrieve authorized results; the V1
  app does not create a dedicated search-history table.
- Device messaging: Expo push token, platform, optional device name, app version
  and delivery status.
- Local device: native auth/cache/outbox envelopes are stored on device for
  session and offline recovery. Web auth is session-scoped and Web message
  cache/outbox is memory-only.

V1 does not intentionally collect location, contacts, financial data, health
data, audio, advertising identifiers or files outside the supported images.

## Purposes

Data is used only to authenticate users; maintain profiles and conversations;
deliver, synchronize and search authorized messages; provide receipts,
presence, notifications and offline recovery; enforce privacy, abuse and rate
limits; process reports; and delete accounts.

There are no ads, in-app purchases, data sales or independent third-party
marketing uses in V1.

## Security statement

Network traffic is encrypted in transit. Server data uses Supabase access
controls, RLS/RPC boundaries and private Storage policies. Native local
sensitive state uses authenticated encryption. PulseChat V1 is **not
end-to-end encrypted**: authorized backend services can process message content
to provide storage, synchronization, search, moderation reports and push
previews when enabled.

## Service providers

- Supabase: authentication, PostgreSQL database, Storage, Realtime and Edge
  Functions.
- Expo Push Service: routes push notification requests.
- Google Firebase Cloud Messaging: delivers Android notifications.

These providers process data under the operator's configuration and terms. The
owner must review the current contracts, regions and retention settings before
submitting the Data safety form.

## Retention and deletion

Users can delete their account inside PulseChat. The deletion flow removes the
authentication account and cascaded profile, membership, settings, privacy,
block, report and push-token records. Profile/group-avatar cleanup is attempted.

Shared messages and photos can remain as anonymized conversation history after
account deletion so other conversation members retain their record. Message
delete-for-everyone immediately redacts durable message/attachment metadata;
physical object cleanup is best effort. Infrastructure security/operational
logs follow the configured provider retention.

The public deletion page must offer an email-based path for a user who cannot
open the app and must describe retained anonymized shared content honestly.

## Audience

The controlled internal beta is for adults aged 18 or older. It is not directed
to children and should not be placed in a Families/children target group.

## Owner sign-off

This is a product-fact draft, not jurisdiction-specific legal advice. The app
owner must verify that the published policy matches the deployed backend,
processor terms, actual support process and Play Console answers.

# Phase 25 Google Play Data safety working answers

Canonical machine-readable source:
`release/play-store/data-safety.json`

## Recommended declarations

| Question | V1 answer |
| --- | --- |
| Does the app collect or share required user data? | Collects data; service-provider processing is present. |
| Is data encrypted in transit? | Yes. |
| Can users request deletion? | Yes, in app and through the required public deletion page. |
| Does the app sell data? | No. |
| Is data shared for advertising/independent third-party purposes? | No. |
| Ads | None. |
| Independent security review | Not completed; do not claim one. |
| End-to-end encryption | No; do not claim it. |

## Data-type mapping

| Play category | Required? | Purpose | Notes |
| --- | --- | --- | --- |
| Email address | Required | App functionality, account management | Supabase Auth account. |
| Name | Required | App functionality, account management | Display name; username is optional. |
| User IDs | Required | Functionality, account management, security | Auth/user/conversation identifiers. |
| Other in-app messages | Optional use | App functionality | Direct/group text and captions. |
| Photos | Optional use | App functionality | Avatars, group avatars and sent images. |
| App interactions | Required | Functionality, security | Membership, receipts, settings, blocks and rate-limit events. |
| In-app search history | Optional, ephemeral | App functionality | Query is processed for search; no dedicated V1 history table. |
| Other user-generated content | Optional | Functionality, account/safety | Bio, reactions and report details. |
| Device or other IDs | Optional | App functionality | Expo push token, platform/device/app metadata. |

Google's exact form and processor classification can change. The owner must
reconcile these answers against the current console wording and the deployed
Supabase/Expo/Firebase settings immediately before submission. Service providers
acting only on the developer's behalf are commonly excluded from “sharing,” but
that exclusion must be confirmed against the current policy and contracts.

## Retention disclosure

Account-linked profile/settings/membership/token data is deleted by the account
deletion flow. Shared conversation content may remain anonymized for other
participants. Message deletion redacts access metadata immediately; physical
image cleanup is best effort. Do not promise blanket immediate erasure of all
shared messages or provider logs.

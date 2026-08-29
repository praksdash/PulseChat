# Phase 23 V1 UX/accessibility acceptance

Status: `READY FOR OWNER/DEVICE ACCESSIBILITY QA`  
Acceptance is not complete until every required row is signed Pass on the same
configured build, or a linked defect is fixed and retested.

## Evidence identity

| Field | Record before testing |
| --- | --- |
| Build profile / artifact |  |
| Git commit / source ZIP SHA-256 |  |
| Android application ID | `com.prakashdash.pulsechat` |
| Phone A model / Android / build |  |
| Phone B model / Android / build |  |
| Supabase project reference |  |
| Tester / UTC date |  |

## Prerequisites

- [ ] Phase 21 migration is applied and `supabase/phase21_verify.sql` passes.
- [ ] `send-message-push` and `delete-account` are deployed with required secrets.
- [ ] `npm run qa:preflight` passes with zero failures.
- [ ] `npm run qa:phase23` passes from a clean dependency installation.
- [ ] The same configured Android build is installed on both phones.
- [ ] Test accounts/data are disposable and contain no sensitive personal data.

## Required device matrix

Record `Pass`, `Fail + defect ID`, or `N/A + reason`.

| Check | Normal text / Light | Large text / Light | Normal text / Dark | Large text / Dark |
| --- | --- | --- | --- | --- |
| Login and registration are readable, scrollable, and keyboard-safe |  |  |  |  |
| Chats header/search/rows do not clip or overlap |  |  |  |  |
| Global search field, wrapping tabs, results, errors, and retry remain usable |  |  |  |  |
| Direct/group chat header, bubbles, composer, context bar, and send controls remain usable |  |  |  |  |
| Group creation/info/member actions remain readable and reachable |  |  |  |  |
| Profile/settings/privacy/notifications/account remain readable and reachable |  |  |  |  |
| Report, message-actions, attachment, confirmation, and media modals fit and dismiss |  |  |  |  |

Use Android's largest practical Font size and Display size that the UI supports;
do not reduce the setting merely to make a failure disappear.

## TalkBack checks

| ID | Required check | Result / evidence |
| --- | --- | --- |
| A11Y-01 | Enable TalkBack before launch. Login fields announce label, purpose, error, password visibility, and submit busy/disabled state. |  |
| A11Y-02 | Chats announce conversation name, preview, time, unread count, presence/mute context, and “opens conversation”. |  |
| A11Y-03 | Search tabs announce selected state; people/chat/message rows announce useful context and destination. |  |
| A11Y-04 | Text/photo messages expose sender/content/time/status and a discoverable path to message actions. Retry is reachable on failed sends. |  |
| A11Y-05 | Settings toggles announce switch name, checked state, description, and disabled state while saving. |  |
| A11Y-06 | Report reasons announce radio checked state. Focus remains in every open modal and returns sensibly after close. |  |
| A11Y-07 | Loading/progress, offline state, permission failures, save success, and errors are announced once without trapping focus. |  |
| A11Y-08 | Every icon-only action has an accurate name; no actionable item is announced only as “button”. |  |
| A11Y-09 | Back from a refreshed/deep-linked chat, group, privacy, blocked-user, profile-edit, or registration route reaches its safe V1 destination. |  |
| A11Y-10 | Swipe navigation reaches each actionable control once in a logical order; decorative icons/images do not create confusing stops. |  |

## State and recovery checks

| ID | Required check | Result / evidence |
| --- | --- | --- |
| UX-01 | Deny notification permission. Notifications screen explains the state and offers a recoverable action without blocking messaging. |  |
| UX-02 | Deny/cancel camera and photo access. Attachment menu closes or remains usable and presents a clear error/retry path. |  |
| UX-03 | Disconnect network on Chats, Search, Chat, Privacy, and Blocked users. Cached/empty/error states are truthful and Retry works after reconnect. |  |
| UX-04 | Open the keyboard on every V1 form at large text. Focused input and primary action remain reachable; drag dismiss works. |  |
| UX-05 | Rotate or use the narrowest supported screen. Text/actions do not overlap, disappear, or require an undiscoverable gesture. |  |
| UX-06 | Toggle System/Light/Dark, restart, and confirm the chosen theme persists with readable text and visible focus/press state. |  |
| UX-07 | Force a blocked-user/privacy load failure. The UI shows “unavailable” plus Retry, not false data or editable defaults. |  |

## Prototype V1 regression

- [ ] Two accounts create/edit profiles and discover each other.
- [ ] Direct realtime text and image messages work in both directions.
- [ ] Unread plus sent/delivered/read state is correct.
- [ ] Background push arrives once and opens the exact authorized conversation.
- [ ] A small group can be created and exchange messages.
- [ ] Offline text replay creates no duplicate rows.
- [ ] Close/reopen restores conversations and messages.
- [ ] Reply/edit/delete/reaction, privacy, search, mute, and settings regressions pass.

## Defects and sign-off

| Defect ID | Severity | Reproduction / expected / actual | Fix build | Retest |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

Critical/high accessibility defects, unreachable primary actions, false state,
or confusing V1 dead ends block Phase 23 acceptance.

Final decision: `PASS / FAIL`  
Tester/signature:  
UTC date:  
Notes:

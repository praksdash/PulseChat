# Phase 24 Android release acceptance

Status: **READY FOR OWNER EAS BUILD / DEVICE QA — NOT ACCEPTED**

Sign this record only after testing the exact same signed preview APK on two
physical Android phones. Automated exports, Expo Go, development servers, and
native prebuild output do not satisfy this gate.

## Candidate identity and provenance

| Evidence | Required value | Observed / link |
| --- | --- | --- |
| Source package | Phase 24 clean package | |
| Git/source revision | Owner revision or package SHA-256 | |
| EAS owner | Account that owns the project | |
| EAS project ID | `40329ce9-8836-472f-b528-2d758663ce44` | |
| EAS build profile | `preview` | |
| EAS build ID | Required | |
| Artifact URL/build page | Required | |
| APK filename | Required | |
| APK SHA-256 | Required | |
| Application ID | `com.prakashdash.pulsechat` | |
| Version name | `1.0.0` | |
| Version code | `24` | |
| Signing certificate SHA-256 | Required; must match upgrade lineage | |
| Build completion time (UTC) | Required | |

## Automated and configured gates

| Check | Expected | Result / evidence |
| --- | --- | --- |
| Clean `npm ci` | Pass | |
| `npm run qa:phase24` | Pass with no failures | |
| Source secret scan | No committed private values/files | |
| Runtime dependency audit | No high/critical production advisory | |
| `npm run release:gate:configured` | Pass with zero failures | |
| Phase 21 SQL verification | `Phase 21 security verification passed.` | |
| Phase 24 SQL verification | `Phase 24 verification passed.` | |
| Edge Functions | Both current deployments healthy | |
| Database Webhook | Authenticated message INSERT delivery enabled | |
| EAS build | Preview APK succeeds from clean source | |

## Installation, identity, and visual QA

Mark Pass, Fail, or Blocked and add concise evidence.

| Test | Expected | Result / evidence |
| --- | --- | --- |
| Clean install on phone A | Installs without sideload/signature error | |
| Clean install on phone B | Same APK installs without error | |
| Upgrade on retained-state phone | `adb install -r` succeeds; session/cache survives | |
| Package identity | Android reports `com.prakashdash.pulsechat` | |
| App version | Android reports `1.0.0` / `24` | |
| Launcher icon | PulseChat mark is crisp on both launchers | |
| Themed icon | Android 13+ monochrome icon remains recognizable | |
| Splash | PulseChat mark renders cleanly in light/dark device modes | |
| App label | `PulseChat` appears consistently | |
| First camera use | Permission is contextual; allow and deny paths recover | |
| Android 13+ notifications | Permission is contextual; deny path remains usable | |
| Notification small icon | White PulseChat status-bar mark is legible | |

## Prototype V1 two-phone acceptance

Use independent accounts A and B on the two phones.

| Test | Expected | Result / evidence |
| --- | --- | --- |
| Register/sign in | Both users create or enter accounts | |
| Profiles | Both save valid profile identity/avatar flows | |
| Discovery/direct chat | A and B find each other and open one direct chat | |
| Realtime text | Both directions appear once without refresh | |
| Secure images | Both directions upload/render after restart | |
| Receipts/unread | Sent, delivered, read, row count, and tab badge reconcile | |
| Background push | Backgrounded B receives one A message notification | |
| Terminated push | Normally dismissed B receives one notification | |
| Notification routing | Tap opens the exact direct/group conversation | |
| Foreground suppression | Open active chat shows realtime bubble, not duplicate banner | |
| Group chat | A creates a small group; all members exchange messages | |
| Offline text replay | Two queued texts reconnect once each in order | |
| Restart persistence | Both apps reopen with conversations/messages intact | |
| Sign-out privacy | Prior account content/token is not exposed after sign-out | |

## Release regressions and accessibility

| Test | Expected | Result / evidence |
| --- | --- | --- |
| Reply/edit/delete/reaction | Existing message actions still reconcile | |
| Search/privacy/mute | V1 controls still enforce server behavior | |
| Deep-link/back | Push/deep-link route has deterministic safe Back behavior | |
| TalkBack | Core routes/actions have useful name, role, state, and order | |
| Largest practical font/display | Primary V1 actions do not clip or disappear | |
| Light/dark | Core screens and system bars remain readable | |
| Poor network/reconnect | Truthful offline states and recovery; no cross-chat data | |
| Upgrade signing continuity | Prior accepted build upgrades without mismatch | |
| Uninstall/reinstall | Clean state is correct; server data restores after login | |

## Defects

| ID | Severity | Reproduction | Owner | Resolution / retest |
| --- | --- | --- | --- | --- |
| | | | | |

Any application crash, data leak/cross-account bleed, authorization bypass,
message loss/duplication, unusable core action, signing mismatch, wrong package
identity, or broken background push is release-blocking.

## Sign-off

- APK SHA-256 rechecked before sign-off: ______________________________
- Tester name: ______________________________
- Test date/time (UTC): ______________________________
- Devices / Android versions: ______________________________
- Result: PASS / FAIL / BLOCKED
- Owner approval: ______________________________

Phase 24 may move to **ACCEPTED** only when all required rows pass with the
candidate provenance filled in and no release-blocking defect remains. Phase 22
and Phase 23 retain their own evidence requirements; this combined run may
supply that evidence, but it does not silently waive their sign-off records.

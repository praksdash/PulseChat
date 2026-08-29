# Phase 23 accessibility review

## Result

The Prototype V1 source has no critical issue in the reviewed accessibility,
navigation, keyboard, loading/error, contrast, font-scaling, or modal paths.
Phase 23 does not claim physical TalkBack acceptance; that evidence belongs in
`docs/PHASE23_ACCEPTANCE.md`.

## Resolved findings

| Area | Finding | Phase 23 resolution |
| --- | --- | --- |
| Contrast | Several light semantic colors were below 4.5:1; dark action surfaces used white text with weak contrast | Strengthened light tokens and added `onPrimary`, `onDanger`, and `onWarning` foregrounds for both themes |
| Font scaling | Shared text/inputs relied on implicit defaults and fixed controls could clip | Shared text/input components explicitly scale up to 2×; fixed headers/actions were changed to minimum heights where needed |
| Buttons/fields | Loading, disabled, helper, and error state was not consistently announced | Shared controls now expose accessible labels, busy/disabled state, progress roles, field hints, and assertive errors |
| Settings | Only the small native switch was interactive | The full settings row is a named switch with checked/disabled state |
| Search | Filter pills were generic buttons with 34-point height and no selected state | Filters are 44-point wrapping tabs with selected state; partial errors and progress are announced |
| Conversations | Chat/message results lacked enough spoken context; message actions depended on an undiscoverable long press | Rows announce useful preview/sender/time/unread context; message/photo bubbles expose action hints and accessible action entry |
| Modals | Report and message-action sheets nested Pressables, producing invalid nested web controls | Backdrop dismiss targets are siblings of modal cards and cards isolate accessibility focus |
| Navigation | Several routes called `router.back()` without a deep-link/refresh fallback | Chat, group, privacy, blocked-user, profile-edit, and registration exits now replace to a safe V1 route when history is absent |
| Touch targets | Back/close/search/reaction controls were as small as 28–42 points | Known interactive controls now meet the 44-point minimum |
| Failure states | A blocked-user load failure looked like “No blocked users”; privacy defaults remained editable after load failure | Both paths now show an explicit unavailable state and retry action |
| Keyboard | Member, auth, profile, and global-search scroll areas had inconsistent keyboard adjustment | V1 text-entry scroll views now adjust for the keyboard and dismiss predictably on drag |

## Verified contrast pairs

All ratios are calculated from the shipped semantic tokens using the WCAG
relative-luminance formula. Small text/action foregrounds require at least
4.5:1.

| Theme/use | Foreground | Background | Ratio |
| --- | --- | --- | ---: |
| Light primary action | `#FFFFFF` | `#0969DA` | 5.19:1 |
| Light destructive action | `#FFFFFF` | `#C9373C` | 5.13:1 |
| Light warning banner | `#FFFFFF` | `#9A5B00` | 5.43:1 |
| Light success text | `#147A52` | `#FFFFFF` | 5.34:1 |
| Light secondary text | `#5E6D79` | `#FFFFFF` | 5.33:1 |
| Light tertiary text | `#65727D` | `#FFFFFF` | 4.93:1 |
| Dark primary action | `#07111C` | `#58A6FF` | 7.52:1 |
| Dark destructive action | `#07111C` | `#FF6B70` | 6.86:1 |
| Dark warning banner | `#07111C` | `#FFB547` | 10.81:1 |
| Dark tertiary text | `#A3AFBA` | `#171D24` | 7.59:1 |

## Automated evidence

The final package gate is:

```bash
npm ci
npm run qa:preflight
npm run qa:phase23
```

Clean local execution on 2026-08-29 UTC produced:

| Check | Result |
| --- | --- |
| Clean dependency install | Pass — 856 packages from lockfile |
| Strict configured preflight | Pass — 0 failures, 0 warnings |
| TypeScript / ESLint | Pass / Pass |
| Unit tests | Pass — 13/13 |
| Secret scan | Pass |
| Production dependency severity gate | Pass — 0 high, 0 critical |
| Accessibility audit | Pass — 0 findings |
| Android Metro export | Pass — 1 Hermes bundle, 27 assets |
| Web static export | Pass — 40 routes |

The production audit still reports 11 moderate transitive Expo CLI/config/xcode
findings. Its force remediation changes the pinned Expo SDK dependency set, so
it is not taken as a Phase 23 UX patch.

The shareable ZIP intentionally excludes `.env`, Firebase configuration,
service-account files, signing keys, generated exports, and dependencies.

## Manual boundary

Static inspection and Metro exports cannot establish TalkBack focus order,
spoken output quality, Android font/display-size behavior, physical keyboard
occlusion, OS permission dialogs, background push, or two-device realtime
behavior. Those remain signed device checks.

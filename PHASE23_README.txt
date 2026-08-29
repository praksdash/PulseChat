PulseChat Phase 23 V1 — UX and Accessibility Polish
===================================================

Objective
---------
Remove critical accessibility problems and confusing Prototype V1 dead ends
without adding product scope. Calls, E2EE, audio/video/files, stories, bots,
channels, broadcasts, desktop clients, and production observability remain
post-V1 work.

Implemented polish
------------------
- Light and dark semantic colors now provide accessible foregrounds for primary,
  destructive, warning, success, secondary, and tertiary content.
- Shared text and input components support bounded device font scaling.
- Shared buttons expose names plus disabled/busy state; fields expose labels,
  helper/error context, and accessible password controls.
- Conversation/search rows describe their preview, sender, time, unread, and
  destination instead of announcing a generic button.
- Settings toggles use the entire row as a labeled switch with checked/disabled
  state.
- Report and message-action dialogs no longer nest interactive Pressables and
  isolate modal accessibility focus.
- Back navigation has a deterministic authenticated fallback when a screen is
  opened by refresh, notification, or deep link.
- Known back, close, reaction, and search-filter targets meet a 44-point minimum.
- Loading, error, offline, saved, and upload states announce progress or feedback.
- Keyboard-aware scrolling is enabled on the V1 forms and search/member flows.
- Privacy and blocked-user load failures now have explicit retry states instead
  of exposing stale defaults or a false empty result.

Automated gate
--------------
- `npm run audit:accessibility` checks WCAG 4.5:1 semantic color pairs, shared
  labels/scaling/state, modal structure, safe-back fallbacks, semantic
  foregrounds, and the known 44-point target set.
- Three new unit tests cover contrast math, navigation fallback detection, and
  the complete project audit. The suite contains 13 tests.
- `npm run qa:phase23` runs TypeScript, ESLint, all unit tests, secret scanning,
  the high/critical dependency gate, source preflight, the accessibility audit,
  and fresh Android/Web exports.
- `npm run qa:preflight` remains the strict private-config check for connected
  device QA.

Manual exit gate
----------------
Complete `docs/PHASE23_ACCEPTANCE.md` on a configured Android build. Test normal
and largest practical font sizes, TalkBack, light/dark modes, keyboard flows,
permission/error recovery, deep-link back behavior, and the full Prototype V1
message path. Record every result; automation is not a TalkBack or physical
device acceptance claim.

Status
------
Phase 23 source polish and local automation are complete. Phase 23 is
`READY FOR OWNER/DEVICE ACCESSIBILITY QA`, not accepted. Phase 22 also remains
`READY FOR OWNER/DEVICE QA` until its signed two-phone sheet is complete.

Recommended commit
------------------
feat: polish Phase 23 V1 UX and accessibility

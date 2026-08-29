# Phase 22 Prototype V1 acceptance

## Acceptance status

`READY FOR OWNER/DEVICE QA`

The source package has automated evidence, but only the project owner can apply
the migration, deploy the Edge Functions, install a push-capable build, and
exercise Firebase/Supabase behavior on two physical Android phones. Record that
evidence below. Do not mark Phase 22 accepted from a Metro export alone.

## Test record

| Field | Record before testing |
| --- | --- |
| Test date/time | |
| Tester | |
| Source/package SHA-256 | |
| EAS build ID or APK identity | |
| App version/build | |
| Supabase project reference | |
| Phase 21 SQL verification result/time | |
| Edge Function deployment time | |
| Phone A model / Android version | |
| Phone B model / Android version | |
| Account A test email | |
| Account B test email | |

Never record passwords, access tokens, service credentials, Firebase private
keys, or the contents of `google-services.json` in this document.

## Gate 1 — owner environment

1. Add `.env` with the real `EXPO_PUBLIC_SUPABASE_URL` and publishable client key.
2. Add the private Firebase Android `google-services.json` at the project root.
3. Run:

   ```bash
   npm ci
   npm run qa:preflight
   ```

4. Apply:

   ```text
   supabase/migrations/202608280017_phase21_security_hardening.sql
   ```

5. Run `supabase/phase21_verify.sql` in the linked project. Require exactly:

   ```text
   Phase 21 security verification passed.
   ```

6. Redeploy the changed functions:

   ```bash
   npx supabase functions deploy send-message-push --no-verify-jwt
   npx supabase functions deploy delete-account --no-verify-jwt
   ```

7. Confirm the existing Database Webhook still sends `messages` INSERT events
   to `send-message-push` with the configured shared secret.

| Check | Expected | Result / evidence |
| --- | --- | --- |
| Strict preflight | Zero failures | |
| Phase 21 SQL verification | Passed | |
| `send-message-push` | Redeployed | |
| `delete-account` | Redeployed | |
| Database Webhook | Enabled for message inserts | |
| Firebase Android package | `com.prakashdash.pulsechat` | |

Any failed row blocks connected/device testing until corrected.

## Gate 2 — automated candidate

Run from a clean package extraction:

```bash
npm ci
npm run qa:phase22
```

| Check | Expected | Result / evidence |
| --- | --- | --- |
| TypeScript | Pass | |
| ESLint | Pass | |
| Unit tests | 10/10 pass | |
| Committed-secret scan | Pass | |
| Production dependency gate | 0 high, 0 critical | |
| Source preflight | 0 failures | |
| Android export | Pass | |
| Web export | Pass | |

The known 11 moderate Expo CLI/config/xcode/uuid advisories remain upstream in
the pinned SDK 57 toolchain. A breaking force-fix is not part of Phase 22.

## Gate 3 — two-phone core V1 flow

Install the exact same development or preview build on Android phones A and B.
Use two distinct email/password accounts. Start with both apps online.

| ID | Test | Steps | Pass condition | Result |
| --- | --- | --- | --- | --- |
| V1-01 | Accounts | Register/sign in A and B; complete both profiles | Both profiles load and remain account-correct | |
| V1-02 | Discovery | A searches B and opens B's profile | Correct user appears; no duplicate/self result | |
| V1-03 | Direct chat | A starts a chat with B; repeat the action | One direct conversation exists | |
| V1-04 | Text A→B | Keep B inside the chat; A sends text | B receives once without refresh | |
| V1-05 | Text B→A | B replies | A receives once without refresh | |
| V1-06 | Image both ways | Each account sends a gallery image | Preview, upload and receiver image succeed | |
| V1-07 | Unread | Keep B outside chat; A sends three texts | B row/tab shows three unread | |
| V1-08 | Delivered | Open B but remain outside the chat | A's eligible messages become delivered | |
| V1-09 | Read | Open the A/B chat on active B | A's eligible messages become read; unread clears | |
| V1-10 | Background push | Background B normally; A sends once | One OS notification arrives | |
| V1-11 | Push route | Tap B's notification | Exact A/B chat opens and state reconciles | |
| V1-12 | Terminated push | Swipe B away normally; A sends | Notification still arrives; do not Android force-stop | |
| V1-13 | Small group | A creates an A/B group and sends text/image | B receives both; group row updates | |
| V1-14 | Restart | Close/reopen both apps | Accounts, conversations, messages and images restore | |
| V1-15 | Offline replay | Disable A network; queue two texts; reconnect | Both send once; no duplicate database rows | |
| V1-16 | Image retry | Cause a retryable image failure; retry once | One durable message/object; image remains readable | |

For notification testing, do not use Android Settings → Force stop. Android
suppresses background delivery until the user reopens a force-stopped app.

## Gate 4 — Phase 22 race regressions

Use a slow connection or network throttling where possible.

| ID | Regression | Pass condition | Result |
| --- | --- | --- | --- |
| R-01 | Load older messages in chat A, immediately open chat B | No A row, spinner, error or page appears in B | |
| R-02 | Open an old search hit in A, immediately open B | Search window never replaces B's timeline | |
| R-03 | Send text in A, immediately open B before response | A's message never appears in B; it persists in A | |
| R-04 | Send image in A, immediately open B during upload | A's image/progress never appears in B; commit completes safely | |
| R-05 | Receive/read a burst while Chats badge refreshes | Badge settles on the durable unread count | |
| R-06 | Sign out A and sign in B in the same process | A's profile, media and notification preferences never appear for B | |
| R-07 | Fresh install/restart during session persistence | Session restores; no encrypted-session/key mismatch | |
| R-08 | Change global-search query while Load more is running | Old-query rows never append to the new query | |

## Gate 5 — retained safety controls

These are regression checks for features already present. They do not expand
Prototype V1.

| ID | Test | Pass condition | Result |
| --- | --- | --- | --- |
| S-01 | A blocks B | Direct text/image is rejected server-side; history remains | |
| S-02 | Blocked A/B in the same group | Group messages still work | |
| S-03 | Muted direct/group chat | Durable message arrives; remote notification does not | |
| S-04 | Delete an image for everyone | Metadata is redacted; no new signed URL can be minted | |
| S-05 | Retry same `client_message_id` | Existing message reconciles; no duplicate row | |
| S-06 | Disposable account deletion | Sign-in fails afterward; account data is removed/anonymized as documented | |

## Defect record

For every failed case, capture:

| Field | Required detail |
| --- | --- |
| Test ID | Example: V1-10 |
| Build/device/account role | Exact build and A/B phone |
| Preconditions | Online/backgrounded/chat open/etc. |
| Steps | Smallest reliable reproduction |
| Expected | Acceptance-table result |
| Actual | What happened, including visible error |
| Frequency | Example: 3/3 attempts |
| Evidence | Screenshot/video and sanitized Supabase/Edge logs |
| Severity | Blocker / major / minor |

Fix only reproducible V1 blockers/regressions in Phase 22. UI polish and
accessibility improvements belong to Phase 23.

## Final sign-off

Phase 22 can be marked `ACCEPTED` only when:

- Gates 1 and 2 have no failures;
- V1-01 through V1-16 pass on both physical Android phones;
- R-01 through R-08 pass;
- S-01 through S-06 pass or have an explicitly documented non-blocking V1 disposition;
- no open blocker or major data-loss, account-isolation, duplicate-message,
  unread/receipt, push-routing, group, or restart-persistence defect remains.

| Decision | Value |
| --- | --- |
| Final status | `ACCEPTED` / `REJECTED` |
| Open blockers | |
| Accepted by | |
| Acceptance date/time | |
| Notes | |

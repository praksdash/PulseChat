# PulseChat Phase 15 setup

Phase 15 has four pieces: Firebase/FCM, the native Expo build, Supabase database + Edge Function, and the Database Webhook. External credentials cannot be included in the ZIP.

## A. Firebase / FCM V1

1. In Firebase Console create/select a project.
2. Add an Android app with package **`com.prakashdash.pulsechat`**.
3. Download `google-services.json` and place it at the PulseChat project root beside `app.json`.
4. Firebase → Project settings → Service accounts → **Generate new private key**. Treat this JSON as a secret; do not commit/copy it into PulseChat.
5. Run `eas credentials` and upload that service-account key for Android FCM V1 push credentials (Android → production → Google Service Account → Push Notifications / FCM V1).

## B. Expo client dependency and native rebuild

```powershell
npx expo install expo-notifications
npx expo install --check
npx expo-doctor
adb uninstall com.prakashdash.pulsechat
npx expo prebuild --clean
npx expo run:android
```

`expo-notifications` and `google-services.json` are native build changes. `npx expo start` alone cannot add them to an already-installed development client.

After the fresh app opens, login and allow notification permission. An enabled row should appear in `public.push_tokens` after the Phase 15 SQL is installed.

## C. Database migration

Run in Supabase SQL Editor:

`supabase/migrations/202608160013_phase15_push_notifications.sql`

Then run:

`supabase/phase15_verify.sql`

Expected important values:
- both push tables: RLS `true`
- `authenticated_can_register = true`
- `authenticated_can_disable = true`
- `anon_can_register = false`
- `authenticated_can_claim_delivery = false`
- `service_role_can_claim_delivery = true`

## D. Expo push enhanced security

1. Expo dashboard → Access Tokens → create a server token.
2. Enable **Enhanced Security for Push Notifications** for the Expo project.
3. Keep the token private. It belongs only in the Supabase Edge Function secret `EXPO_ACCESS_TOKEN`.

## E. Deploy the Edge Function

Generate a separate webhook secret locally:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output somewhere private. Do not put it in the React Native `.env`.

Using the Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase secrets set PUSH_WEBHOOK_SECRET="<YOUR_RANDOM_SECRET>" EXPO_ACCESS_TOKEN="<YOUR_EXPO_ACCESS_TOKEN>"
npx supabase functions deploy send-message-push --no-verify-jwt
```

The hosted function automatically receives Supabase server credentials. Never add a service-role/secret key to the mobile `.env`.

## F. Create the Database Webhook

Supabase Dashboard → Database → Webhooks → Create webhook:

- name: `push-new-message`
- schema/table: `public.messages`
- event: **INSERT only**
- destination/type: Supabase Edge Function
- function: `send-message-push`
- method: POST
- header: `x-pulsechat-webhook-secret` = the exact `PUSH_WEBHOOK_SECRET`
- Content-Type: `application/json`

The function uses the shared secret itself, so the public/mobile key is not involved in webhook authorization.

## G. End-to-end test

Best test: Browser Account A + Android Account B.

1. Login B in the freshly rebuilt Android app and allow notifications.
2. Confirm B has an enabled row in `public.push_tokens`.
3. Put Android PulseChat in the background (do not force-stop it from Android Settings).
4. From browser A send B a text.
5. B should receive one notification.
6. Tap it: PulseChat opens exactly that conversation.
7. Send an image and then a group message; both should notify correctly.

For troubleshooting run `supabase/phase15_diagnostics.sql` and inspect Supabase Edge Function logs.

- no `push_tokens` row → client permission/Firebase/native build problem
- token exists but no `push_delivery_log` row → Database Webhook/Edge Function invocation problem
- `push_delivery_log.status = error` → inspect `error_code` / `error_message`
- `MismatchSenderId` / `InvalidCredentials` → verify `google-services.json` and the EAS FCM V1 service account belong to the same Firebase project

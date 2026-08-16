PulseChat Phase 15 notification completion fix
==============================================

This package replaces the Phase 15 placeholder Notifications row with a real
Notifications settings screen and adds diagnostics/tests for Android push.

Native Android/iOS
------------------
- Shows OS permission and server registration count.
- Enable/refresh push registration.
- Local notification test (tests app/OS channel only).
- Remote server push test (tests token + Supabase Edge Function + Expo Push).
- Existing automatic message push remains server-side through the messages INSERT webhook.

Web
---
- Uses the browser Notification API because expo-notifications does not support web.
- User can explicitly enable browser notifications and send a test.
- Incoming Realtime messages show a browser notification while PulseChat web is
  open and its tab is in the background.
- This package does NOT claim closed-browser Web Push. That requires a service
  worker + Push API/VAPID backend and is separate from Expo Notifications.

Required after copying this package
-----------------------------------
1. No new SQL migration is required if Phase 15 SQL already ran.
2. Redeploy the updated Edge Function:
     npx supabase functions deploy send-message-push --no-verify-jwt
3. Keep PUSH_WEBHOOK_SECRET configured and keep the public.messages INSERT
   Database Webhook pointing at send-message-push with the matching header.
4. Open Profile > Notifications.
5. Android: Enable > local test > remote server test.
6. Web: Enable browser notifications > browser test; then background the tab and
   send a message from another account.

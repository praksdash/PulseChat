PulseChat Phase 15 — Secure Push Notifications
==============================================

Adds Expo Push Notifications + Supabase server-side dispatch for newly inserted
text/image/group messages.

Files of interest
-----------------
- supabase/migrations/202608160013_phase15_push_notifications.sql
- supabase/phase15_verify.sql
- supabase/functions/send-message-push/index.ts
- supabase/config.toml
- src/services/push-notification-service.ts
- src/services/push-token-service.ts
- src/components/auth/push-notification-bridge.tsx

External setup is required because Firebase, EAS and Supabase secrets cannot be
bundled into a source ZIP. Follow the installation steps in the ChatGPT response.
Never put a Firebase service-account private key, Expo access token, Supabase
service-role/secret key or PUSH_WEBHOOK_SECRET in the React Native .env file.

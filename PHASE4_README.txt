PULSECHAT — PHASE 4 SUPABASE AUTHENTICATION
==========================================

This is a full Phase 4 source package built on the working Phase 3 UI.

WHAT PHASE 4 ADDS
-----------------
- Real Supabase email/password signup and login
- Persistent authenticated session
- Encrypted native auth-session storage
- Protected Expo Router app/auth route groups
- Automatic public.profiles row creation
- Own-profile RLS
- Dynamic Profile screen
- Sign out
- Local form validation + friendly errors

IMPORTANT: DO NOT COMMIT .env
-----------------------------
Only put the Project URL and PUBLISHABLE key in the app.
Never use service_role/secret/database-password values in mobile code.

SETUP ORDER
-----------
1. Copy this package over your existing PulseChat source project.
   Keep your local .git, .idea, android, node_modules and .expo folders.

2. Install dependencies from Android Studio Terminal:

   npm install

   If npm reports Expo package compatibility, normalize native packages with:

   npx expo install @react-native-async-storage/async-storage expo-secure-store

3. In Supabase create/open a project.

4. Open Supabase SQL Editor and run the complete file:

   supabase/migrations/202608150001_phase4_auth_profiles.sql

5. In Supabase Project Connect/API details copy:
   - Project URL
   - Publishable key

6. In PulseChat root create .env from .env.example:

   Copy-Item .env.example .env

   Then replace the two placeholder values.

7. Because Phase 4 adds native storage modules, rebuild once with an Android emulator running:

   npx expo run:android

8. After the app has opened, stop Metro if needed and regenerate router types/cache:

   npx expo start -c

9. In a second terminal:

   npm run typecheck

10. Test signup/login/profile/session persistence/logout.

EMAIL CONFIRMATION
------------------
The app supports both behaviors:
- Confirmation disabled: successful signup immediately creates a session.
- Confirmation enabled: signup shows "check your email" and waits for confirmation.

For the quickest local prototype, you may temporarily disable Confirm Email in Supabase Auth email-provider settings. Turn proper verification back on before production.

EXPECTED PROFILE
----------------
After signup, public.profiles should contain one row with the same UUID as auth.users.id and the submitted display name.

GIT CHECKPOINT
--------------
After all tests pass:

git add .
git status
git commit -m "feat: add Supabase authentication"

NEXT
----
Phase 5: username, avatar, bio and profile editing.

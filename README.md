# PulseChat — Phase 4

This package contains the complete PulseChat source through **Phase 4: Supabase Authentication**.

## Included
- Expo SDK 57 + Expo Router
- Working Phase 3 messenger UI/design system
- Real Supabase email/password signup and login
- Protected auth/app route groups
- Persistent native session handling
- Encrypted native auth-session storage
- Automatic `public.profiles` creation
- Row-Level Security for own-profile access
- Dynamic authenticated Profile screen
- Logout
- Supabase migration and setup documentation

## Intentionally excluded from the package
- `node_modules/`
- `.expo/`
- `.git/`
- `.idea/`
- generated `android/` and `ios/` folders
- `.env`

Keep your existing local machine/generated folders when copying this source over the current project.

## Required setup
Follow `PHASE4_README.txt` in order. In short:

1. `npm install`
2. Run `supabase/migrations/202608150001_phase4_auth_profiles.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env` and add your Supabase Project URL + publishable key.
4. Run `npx expo run:android` once because Phase 4 adds native storage dependencies.
5. Run `npx expo start -c`.
6. Run `npm run typecheck` in another terminal.
7. Verify signup, login, session persistence, profile display and logout.

## Phase boundary
Chat rows/messages remain demo data. Real profile editing begins in Phase 5; database conversation design follows in Phase 6.

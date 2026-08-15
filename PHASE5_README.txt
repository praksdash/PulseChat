PulseChat Phase 5 — User Profile
================================

What this package adds
----------------------
- Edit-profile screen
- Display-name editing
- Optional unique username (3–32 lowercase letters/numbers/underscores)
- Username availability check without exposing all profiles
- Bio up to 160 characters
- Profile picture selection from the device library
- 512x512 JPEG compression before upload
- Supabase Storage avatars bucket
- Storage RLS limiting writes/deletes to each user's own UUID folder
- Public avatar URLs for future chat/user-discovery screens
- Avatar removal and old-file cleanup
- Existing working Phase 4 logout fix retained

Required database step
----------------------
Run in Supabase SQL Editor AFTER the Phase 4 migration:
  supabase/migrations/202608150002_phase5_profiles_avatars.sql

Install/update dependencies
---------------------------
  npm install

Because expo-image-picker and expo-image-manipulator are native Expo modules,
rebuild the Android development client once:
  npx expo run:android

Then normal development can use:
  npx expo start -c

Validation
----------
  npm run typecheck
  npm run check:android

Manual test
-----------
1. Sign in.
2. Open Profile -> Edit profile.
3. Change display name and bio; save.
4. Set a valid unique username; save.
5. Try the same username on a second account; it must be rejected.
6. Choose a photo, crop it, save, and confirm it survives app restart.
7. Remove the photo and confirm initials return.
8. Confirm Sign out still returns to Login.

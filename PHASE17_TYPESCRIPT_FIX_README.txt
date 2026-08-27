PulseChat Phase 17 TypeScript Fix
=================================

This hotfix is based on PulseChat_Phase17_WebModalFix_Complete.zip.

Fixes:
1. Expo Router strict route params
   - Narrowed the direct-chat peer user id into a local peerUserId value before
     creating the navigation callback.
   - Prevents string | null from being passed as /users/[userId].

2. ConfirmActionModal React Native StyleSheet compatibility
   - Replaced StyleSheet.absoluteFillObject with explicit absolute positioning.
   - Keeps the web nested-button modal fix intact.

No database migration changes.
No dependency changes.
No Android native rebuild required for development testing.

Verification:
  npm run typecheck
  npx expo start -c

PulseChat Phase 13 Hotfix 2

Fixes:
1. Delete confirmation on web now uses browser confirm instead of React Native Modal/Pressable nesting.
2. Android/iOS use native Alert confirmation.
3. The server-authoritative delete RPC and immediate local soft-delete update remain unchanged.
4. No SQL migration or native dependency change is required.

After copying the package:
  npm run typecheck
  npx expo start -c

If Android development client crashes before React loads, rebuild the development client separately; that native dev-launcher issue is independent from the delete UI.

PulseChat Phase 13 delete hotfix

Problem fixed:
- React Native Web does not implement the React Native Alert API, so the Phase 13
  Alert.alert confirmation could show no actionable callback on web. That made
  "Delete for everyone" appear to do nothing during browser testing.

Changes:
- Replaced Alert.alert delete confirmation with a PulseChat cross-platform Modal.
- Added loading/disabled state while delete RPC runs.
- After the RPC succeeds, the local message is immediately rendered as deleted,
  then reconciled with get_message_detail and Realtime.
- No database migration or new dependency is required.

Run:
  npm run typecheck
  npx expo start -c

PulseChat Phase 17 Web Confirmation Modal Fix
=============================================

Fixes the React Native Web error:
  <button> cannot contain a nested <button>

Root cause:
  ConfirmActionModal used a Pressable backdrop that wrapped the dialog card.
  On web, that Pressable rendered as a <button>, while AppButton controls inside
  the card also rendered as <button>, producing invalid nested-button markup.

Fix:
  The full-screen dismiss Pressable is now an absolutely-positioned sibling
  behind the dialog card. The dialog card itself is a View. This preserves
  click/tap-outside-to-close without placing any AppButton inside a Pressable.

No SQL changes.
No dependency changes.
No native rebuild required for Metro/web testing.

# PulseChat Testing

## Phase 5 manual tests

### Happy path
1. Log in.
2. Profile → Edit profile.
3. Update display name, username and bio.
4. Select/crop an avatar.
5. Save.
6. Confirm Profile immediately shows all changes.
7. Kill/reopen app and confirm changes persist.

### Username validation
- `<3` characters rejected.
- `>32` characters rejected.
- spaces/symbols rejected.
- uppercase input normalizes to lowercase.
- blank username is allowed.
- a username already owned by another account is rejected by both availability check and DB uniqueness.

### Avatar security/behavior
- denied photo permission produces a user-facing message.
- selected image is compressed before upload.
- avatar appears after save and survives restart.
- replacing avatar removes the previous object after successful profile update.
- remove avatar returns to initials.
- user cannot upload/delete under another user's UUID folder.

### Failure path
- network failure while checking username shows a non-destructive availability message.
- network/storage failure during save keeps the edit screen open and shows an error.
- if DB update fails after a new avatar upload, the newly uploaded object is cleaned up.

### Regression
- signup/login/session persistence still work.
- Sign out returns directly to Login.
- Chats/Search/Profile navigation still works.

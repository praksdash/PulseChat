# PulseChat Testing

## Phase 4 manual test matrix

### Happy path
1. Create a new account.
2. If email confirmation is disabled, app enters Chats automatically.
3. Open Profile and confirm display name + email are correct.
4. Close the app fully and reopen it; session should restore.
5. Sign out; app should return to Login.
6. Sign back in successfully.

### Email confirmation path
With Confirm Email enabled, signup should show a confirmation instruction instead of entering the app without a session.

### Validation
- Invalid email is blocked locally.
- Empty password is blocked locally.
- Registration password shorter than 8 characters is blocked locally.
- Password mismatch is blocked locally.

### Failure path
- Wrong password shows a friendly error.
- Offline/network failure shows a network-oriented error.
- Missing `.env` renders a configuration warning and disables auth submission.

### Permission / RLS test
Create two users. In Supabase SQL/REST testing as each authenticated user, confirm user A cannot select/update user B's `profiles` row.

### Persistence test
Sign in -> terminate app -> relaunch -> Chats should appear without another login.

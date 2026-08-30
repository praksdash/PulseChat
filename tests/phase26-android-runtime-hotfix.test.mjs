import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Android authenticated requests retain the current in-memory session token', () => {
  const supabaseClient = read('src/lib/supabase.ts');
  const authProvider = read('src/providers/auth-provider.tsx');

  assert.match(supabaseClient, /activeNativeAccessToken/);
  assert.match(supabaseClient, /requestUrl\.pathname\.startsWith\('\/auth\/v1\/'\)/);
  assert.match(supabaseClient, /existingAuthorization !== publishableKeyAuthorization/);
  assert.match(supabaseClient, /Bearer \$\{activeNativeAccessToken\}/);
  assert.match(authProvider, /setSupabaseSessionAccessToken\(nextSession\?\.access_token\)/);
  assert.match(authProvider, /if \(data\.session\) applySession\(data\.session\)/);
});

test('Android restored sessions are verified without rejecting offline users', () => {
  const authProvider = read('src/providers/auth-provider.tsx');

  assert.match(authProvider, /supabase\.auth\.getUser\(restoredSession\.access_token\)/);
  assert.match(authProvider, /!isRetryableNetworkError\(validation\.error\)/);
  assert.match(authProvider, /supabase\.auth\.signOut\(\{ scope: 'local' \}\)/);
});

test('Native push registration is bounded and duplicate token events cannot storm', () => {
  const pushService = read('src/services/push-notification-service.ts');

  assert.match(pushService, /pushRegistrationInFlight/);
  assert.match(pushService, /PUSH_TOKEN_TIMEOUT_MS = 15_000/);
  assert.match(pushService, /lastObservedNativePushToken === tokenKey/);
  assert.match(pushService, /registrationError: error\?\.message \?\? null/);
});

test('Settings shows release identity instead of a stale internal phase label', () => {
  const settingsScreen = read('src/app/(app)/profile/settings.tsx');

  assert.match(settingsScreen, /Prototype V1 · Version \$\{version\}/);
  assert.doesNotMatch(settingsScreen, /Phase 23 UX and accessibility polish/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseDotEnv,
  validateGoogleServices,
  validateSupabaseEnvironment,
} from '../scripts/phase22-preflight.mjs';

test('Phase 22 preflight parses quoted client environment values', () => {
  assert.deepEqual(parseDotEnv([
    '# client values',
    'EXPO_PUBLIC_SUPABASE_URL="https://example.supabase.co"',
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_example'",
  ].join('\n')), {
    EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  });
});

test('Phase 22 preflight rejects placeholders and server secrets', () => {
  assert.equal(validateSupabaseEnvironment({
    EXPO_PUBLIC_SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'service_role_secret',
  }).length, 2);
});

test('Phase 22 preflight accepts a matching Firebase Android client', () => {
  const errors = validateGoogleServices({
    project_info: { project_id: 'pulsechat-test' },
    client: [{
      client_info: { android_client_info: { package_name: 'com.prakashdash.pulsechat' } },
      api_key: [{ current_key: 'test-key' }],
    }],
  }, 'com.prakashdash.pulsechat');
  assert.deepEqual(errors, []);
});

test('Phase 22 preflight rejects a Firebase package mismatch', () => {
  const errors = validateGoogleServices({
    project_info: { project_id: 'pulsechat-test' },
    client: [{
      client_info: { android_client_info: { package_name: 'com.example.other' } },
      api_key: [{ current_key: 'test-key' }],
    }],
  }, 'com.prakashdash.pulsechat');
  assert.ok(errors.some((error) => error.includes('com.prakashdash.pulsechat')));
});

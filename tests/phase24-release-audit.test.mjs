import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditRelease,
  readPngMetadata,
  validateReleaseIdentity,
} from '../scripts/phase24-release-audit.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

test('Phase 24 launcher asset is a 1024px PNG', () => {
  const metadata = readPngMetadata(path.join(projectRoot, 'assets/images/icon-phase24.png'));
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
});

test('Phase 24 release audit passes for the shareable source', () => {
  assert.deepEqual(auditRelease(projectRoot, { sourceOnly: true }).failures, []);
});

test('Phase 24 secure-envelope uses the local Metro-safe cipher runtime', () => {
  const runtimePath = require.resolve('../src/vendor/noble-ciphers-runtime.js');
  const runtime = require(runtimePath);
  assert.match(runtimePath, /noble-ciphers-runtime\.js$/);
  assert.equal(typeof runtime.gcm, 'function');
  assert.equal(typeof runtime.utf8ToBytes, 'function');
});

test('Phase 24 rate-limit migration removes the actor_user_id conflict target ambiguity', () => {
  const migration = fs.readFileSync(
    path.join(projectRoot, 'supabase/migrations/202608290018_phase24_rate_limit_ambiguity_fix.sql'),
    'utf8',
  ).toLowerCase();
  assert.match(migration, /on conflict on constraint rate_limit_state_pkey/);
  assert.doesNotMatch(migration, /on conflict\s*\(actor_user_id,\s*action_key\)/);
  assert.match(migration, /values\s*\(\s*\$1,/);
});

test('Phase 24 native smoke uses a permission-safe Windows junction', () => {
  const nativeSmoke = fs.readFileSync(
    path.join(projectRoot, 'scripts/phase24-native-smoke.mjs'),
    'utf8',
  );
  assert.match(nativeSmoke, /process\.platform === 'win32' \? 'junction' : 'dir'/);
  assert.match(nativeSmoke, /spawnSync\(process\.execPath, \[expoCli,/);
  assert.match(nativeSmoke, /'node_modules', 'expo', 'bin', 'cli'/);
  assert.match(nativeSmoke, /String\(name\)\.split\(path\.sep\)\.join\('\/'\)/);
  assert.match(nativeSmoke, /android\\\.permission\\\.RECORD_AUDIO/);
  assert.match(nativeSmoke, /ANDROID_AUDIO_TYPE/);
});

test('Phase 24 identity validator rejects remote implicit versioning', () => {
  const baseline = {
    applicationId: 'com.prakashdash.pulsechat',
    versionName: '1.0.0',
    versionCode: 24,
    easProjectId: 'project-id',
    easCliVersion: '22.0.0',
  };
  const errors = validateReleaseIdentity({
    appJson: { expo: { version: '1.0.0', android: { package: baseline.applicationId, versionCode: 24, permissions: [] }, extra: { eas: { projectId: 'project-id' } }, plugins: [] } },
    easJson: { cli: { version: '22.0.0', appVersionSource: 'remote' }, build: {} },
    packageJson: { version: '1.0.0', devDependencies: { 'eas-cli': '22.0.0' }, packageManager: 'npm@11.9.0' },
    baseline,
  });
  assert.ok(errors.some((error) => error.includes('appVersionSource')));
});

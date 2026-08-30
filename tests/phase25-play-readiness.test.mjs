import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditPlayReadiness,
  validateListing,
  validateOwnerInputs,
} from '../scripts/phase25-play-readiness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Phase 25 source Play readiness audit has no static failures', () => {
  const result = auditPlayReadiness(projectRoot, { sourceOnly: true });
  assert.deepEqual(result.failures, []);
  assert.equal(result.warnings.some((warning) => warning.includes('screenshots')), false);
  const ownerInputsConfigured = fs.existsSync(
    path.join(projectRoot, 'release/play-store/owner-inputs.json'),
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Owner Play')),
    !ownerInputsConfigured,
  );
});

test('Phase 25 listing validator enforces Play character limits', () => {
  const failures = validateListing({
    language: 'en-US',
    appName: 'A'.repeat(31),
    shortDescription: 'B'.repeat(81),
    fullDescription: 'Valid',
    releaseNotes: 'Valid',
  });
  assert.ok(failures.some((failure) => failure.includes('App name')));
  assert.ok(failures.some((failure) => failure.includes('Short description')));
});

test('Phase 25 owner validator rejects placeholders and missing confirmations', () => {
  const failures = validateOwnerInputs({
    developerName: '',
    supportEmail: 'support@example.com',
    privacyPolicyUrl: 'https://example.com/privacy',
    accountDeletionUrl: 'https://example.com/delete',
    supportUrl: 'http://example.com/support',
    effectiveDate: '29-08-2026',
    appAccess: {},
    policyConfirmation: {},
  });
  assert.ok(failures.length >= 10);
});

test('Phase 25 exports remain inside phase-scoped output directories', () => {
  const wrapper = fs.readFileSync(path.join(projectRoot, 'scripts/phase24-expo-export.mjs'), 'utf8');
  assert.match(wrapper, /dist-phase\(\?:24\|25\|26\|27-4\)/);
  assert.match(wrapper, /\^dist-phase/);
  assert.match(wrapper, /spawnSync\(process\.execPath, \[/);
  assert.match(wrapper, /'node_modules', 'expo', 'bin', 'cli'/);
});

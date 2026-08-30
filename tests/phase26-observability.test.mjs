import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditObservability,
  validateOperationsOwnerInputs,
} from '../scripts/phase26-observability-audit.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Phase 26 source observability audit has no static failures', () => {
  const result = auditObservability(projectRoot, { sourceOnly: true });
  assert.deepEqual(result.failures, []);
  assert.ok(result.warnings.some((warning) => warning.includes('Owner operations')));
});

test('Phase 26 owner audit rejects missing monitoring and recovery evidence', () => {
  const failures = validateOperationsOwnerInputs({
    operationsOwner: '',
    alertChannel: '',
    receiptScheduleConfirmed: false,
    externalMonitorConfirmed: false,
    backupAutomationConfirmed: false,
    restoreDrillCompletedAt: '',
    restoreDrillEvidence: '',
    dependencyReviewOwner: '',
    nextDependencyReviewDate: '',
  }, new Date('2026-08-29T00:00:00Z'));
  assert.ok(failures.length >= 9);
});

test('Phase 26 push lifecycle requires ticketed before delivered', () => {
  const dispatcher = fs.readFileSync(
    path.join(projectRoot, 'supabase/functions/send-message-push/index.ts'),
    'utf8',
  );
  const receiptWorker = fs.readFileSync(
    path.join(projectRoot, 'supabase/functions/poll-push-receipts/index.ts'),
    'utf8',
  );
  assert.match(dispatcher, /status: ok \? 'ticketed' : 'error'/);
  assert.match(receiptWorker, /status = 'delivered'/);
  assert.match(receiptWorker, /DeviceNotRegistered/);
});

test('Phase 26 diagnostics table excludes content and raw traces', () => {
  const migration = fs.readFileSync(
    path.join(projectRoot, 'supabase/migrations/202608290019_phase26_observability.sql'),
    'utf8',
  );
  const start = migration.indexOf('create table if not exists public.client_diagnostics');
  const definition = migration.slice(start, migration.indexOf(');', start));
  for (const forbidden of ['message_content', 'request_body', 'authorization_token', 'raw_stack_trace']) {
    assert.doesNotMatch(definition, new RegExp(forbidden));
  }
});

test('Phase 26 diagnostics are cleared when the authenticated account changes', () => {
  const diagnosticsService = fs.readFileSync(
    path.join(projectRoot, 'src/services/diagnostics-service.ts'),
    'utf8',
  );
  assert.match(
    diagnosticsService,
    /if \(activeUserId && activeUserId !== userId\) clearBufferedDiagnostics\(\)/,
  );
});

test('Phase 26 lockfile supports npm 10 without changing the app compiler', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
  assert.equal(packageJson.devDependencies.typescript, '~6.0.3');
  assert.equal(packageLock.packages['node_modules/typescript'].version, '6.0.3');
  assert.deepEqual(
    {
      version: packageLock.packages['node_modules/eas-cli/node_modules/typescript'].version,
      optional: packageLock.packages['node_modules/eas-cli/node_modules/typescript'].optional,
      peer: packageLock.packages['node_modules/eas-cli/node_modules/typescript'].peer,
    },
    { version: '5.9.3', optional: true, peer: true },
  );
});

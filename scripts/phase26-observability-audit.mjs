#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function requireFragments(content, fragments, label) {
  return fragments
    .filter((fragment) => !content.includes(fragment))
    .map((fragment) => `${label} is missing required contract: ${fragment}`);
}

export function validateOperationsOwnerInputs(inputs, now = new Date()) {
  const failures = [];
  for (const key of ['operationsOwner', 'alertChannel', 'restoreDrillEvidence', 'dependencyReviewOwner']) {
    if (typeof inputs?.[key] !== 'string' || !inputs[key].trim()) {
      failures.push(`${key} must be configured.`);
    }
  }
  for (const key of [
    'receiptScheduleConfirmed',
    'externalMonitorConfirmed',
    'backupAutomationConfirmed',
  ]) {
    if (inputs?.[key] !== true) failures.push(`${key} must be confirmed.`);
  }

  const restoreDate = new Date(inputs?.restoreDrillCompletedAt ?? '');
  if (Number.isNaN(restoreDate.getTime())) {
    failures.push('restoreDrillCompletedAt must be a valid ISO date.');
  } else {
    const ageDays = (now.getTime() - restoreDate.getTime()) / 86_400_000;
    if (ageDays < 0 || ageDays > 90) failures.push('The restore drill must have completed within the last 90 days.');
  }

  const dependencyReviewDate = new Date(inputs?.nextDependencyReviewDate ?? '');
  if (Number.isNaN(dependencyReviewDate.getTime()) || dependencyReviewDate.getTime() < now.getTime()) {
    failures.push('nextDependencyReviewDate must be a valid future date.');
  }
  return failures;
}

export function auditObservability(root = projectRoot, { sourceOnly = false } = {}) {
  const failures = [];
  const warnings = [];
  const requiredFiles = [
    'src/services/diagnostics-buffer.ts',
    'src/services/diagnostics-service.ts',
    'src/components/auth/diagnostics-bridge.tsx',
    'src/components/system/app-error-boundary.tsx',
    'supabase/migrations/202608290019_phase26_observability.sql',
    'supabase/functions/poll-push-receipts/index.ts',
    'supabase/phase26_verify.sql',
    'release/operations/phase26-observability.json',
    'release/operations/owner-inputs.example.json',
    'docs/PHASE26_OBSERVABILITY_RUNBOOK.md',
    'docs/PHASE26_BACKUP_RESTORE_RUNBOOK.md',
    'docs/PHASE26_INCIDENT_RUNBOOK.md',
    'docs/PHASE26_ACCEPTANCE.md',
    'PHASE26_README.txt',
    'PHASE26_NPM_CI_FIX_README.txt',
    'PHASE26_QA_CONFIG_FIX_README.txt',
  ];
  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(root, relativePath))) failures.push(`Required Phase 26 file is missing: ${relativePath}`);
  }
  if (failures.length > 0) return { failures, warnings, manifest: null };

  const manifest = readJson(root, 'release/operations/phase26-observability.json');
  if (manifest.phase !== 26 || manifest.schemaVersion !== 1) failures.push('Phase 26 observability manifest identity is invalid.');
  if (manifest.scope !== 'prototype-v1-production-hardening') failures.push('Phase 26 must remain inside Prototype V1 scope.');
  if (manifest.diagnostics?.retentionDays !== 30) failures.push('Client diagnostics retention must remain 30 days.');
  if (manifest.diagnostics?.maximumClientBatch !== 20) failures.push('Client diagnostics batches must remain bounded at 20.');
  if (manifest.pushReceipts?.scheduleMinutes !== 5) failures.push('Push receipt polling cadence must remain five minutes.');
  if (manifest.pushReceipts?.receiptReadyDelayMinutes !== 15) failures.push('Expo tickets must age 15 minutes before receipt polling.');
  if (manifest.pushReceipts?.invalidTokenCode !== 'DeviceNotRegistered') failures.push('Invalid Expo tokens must use DeviceNotRegistered cleanup.');

  const migration = readText(root, 'supabase/migrations/202608290019_phase26_observability.sql');
  failures.push(...requireFragments(migration, [
    "status in ('claimed', 'ticketed', 'delivered', 'error')",
    'create table if not exists public.client_diagnostics',
    'create or replace function public.record_client_diagnostics',
    'revoke all on table public.client_diagnostics from public, anon, authenticated',
    'create table if not exists public.operational_jobs',
    'create table if not exists public.operational_alerts',
    'create or replace function public.evaluate_operational_alerts',
    'create or replace view pulsechat_private.rate_limit_dashboard',
    'create or replace view pulsechat_private.storage_dashboard',
    "interval '30 days'",
  ], 'Phase 26 migration'));
  for (const forbiddenColumn of ['message_content', 'profile_content', 'request_url', 'request_body', 'authorization_token', 'raw_stack_trace']) {
    const tableStart = migration.indexOf('create table if not exists public.client_diagnostics');
    const tableEnd = migration.indexOf(');', tableStart);
    const tableDefinition = migration.slice(tableStart, tableEnd);
    if (tableDefinition.includes(forbiddenColumn)) failures.push(`Client diagnostics must not contain ${forbiddenColumn}.`);
  }

  const receiptWorker = readText(root, 'supabase/functions/poll-push-receipts/index.ts');
  failures.push(...requireFragments(receiptWorker, [
    'PUSH_RECEIPT_SECRET',
    'x-pulsechat-receipt-secret',
    'getReceipts',
    'DeviceNotRegistered',
    "status = 'delivered'",
    "status = 'error'",
    "admin.rpc('run_operational_maintenance')",
  ], 'Push receipt worker'));
  if (receiptWorker.includes("Deno.env.get('PUSH_WEBHOOK_SECRET')")) {
    failures.push('Receipt polling must use a secret separate from the message webhook.');
  }

  const dispatcher = readText(root, 'supabase/functions/send-message-push/index.ts');
  if (!dispatcher.includes("status: ok ? 'ticketed' : 'error'")) {
    failures.push('Push dispatcher must record accepted Expo tickets as ticketed, not delivered.');
  }

  const diagnostics = readText(root, 'src/services/diagnostics-buffer.ts');
  failures.push(...requireFragments(diagnostics, [
    'MAX_BUFFERED_EVENTS = 50',
    'clearBufferedDiagnostics',
    'shouldCaptureApiDiagnostic',
    'fingerprintDiagnostic',
  ], 'Client diagnostics buffer'));
  const rootLayout = readText(root, 'src/app/_layout.tsx');
  failures.push(...requireFragments(rootLayout, ['<AppErrorBoundary>', '<DiagnosticsBridge />'], 'Root layout'));

  const supabaseConfig = readText(root, 'supabase/config.toml');
  if (!supabaseConfig.includes('[functions.poll-push-receipts]') || !supabaseConfig.includes('verify_jwt = false')) {
    failures.push('Supabase function config must declare the secret-protected receipt worker.');
  }

  const packageJson = readJson(root, 'package.json');
  const packageLock = readJson(root, 'package-lock.json');
  for (const script of ['ops:audit', 'ops:audit:source', 'qa:phase26']) {
    if (!packageJson.scripts?.[script]) failures.push(`package.json script is missing: ${script}`);
  }
  if (packageJson.devDependencies?.typescript !== '~6.0.3'
    || packageLock.packages?.['node_modules/typescript']?.version !== '6.0.3') {
    failures.push('The app TypeScript compiler must remain locked at 6.0.3.');
  }
  const easNestedTypeScript = packageLock.packages?.['node_modules/eas-cli/node_modules/typescript'];
  if (easNestedTypeScript?.version !== '5.9.3'
    || easNestedTypeScript?.peer !== true
    || easNestedTypeScript?.optional !== true) {
    failures.push('The lockfile must retain the npm 10-compatible nested EAS TypeScript 5.9.3 peer.');
  }

  for (const ignoreFile of ['.gitignore', '.easignore']) {
    if (!readText(root, ignoreFile).includes('release/operations/owner-inputs.json')) {
      failures.push(`${ignoreFile} must exclude release/operations/owner-inputs.json.`);
    }
  }

  const ownerPath = path.join(root, manifest.ownerInputsPath ?? '');
  if (!manifest.ownerInputsPath || !fs.existsSync(ownerPath)) {
    const message = 'Owner operations, monitoring, backup and restore-drill evidence is not configured.';
    if (sourceOnly) warnings.push(message); else failures.push(message);
  } else failures.push(...validateOperationsOwnerInputs(readJson(root, manifest.ownerInputsPath)));

  return { failures, warnings, manifest };
}

function run() {
  const sourceOnly = process.argv.includes('--source-only');
  const { failures, warnings, manifest } = auditObservability(projectRoot, { sourceOnly });
  if (failures.length === 0 && manifest) {
    process.stdout.write('[PASS] Phase 26 metadata-only diagnostics and bounded retention contracts are present.\n');
    process.stdout.write('[PASS] Push receipts, invalid-token cleanup, private alerts, dashboards and runbooks are present.\n');
  }
  warnings.forEach((warning) => process.stdout.write(`[WARN] ${warning}\n`));
  failures.forEach((failure) => process.stdout.write(`[FAIL] ${failure}\n`));
  process.stdout.write(`Phase 26 observability audit: ${failures.length} failure(s), ${warnings.length} warning(s).\n`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();

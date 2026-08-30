#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceOnly = process.argv.includes('--source-only');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulsechat-phase24-native-'));
const tempProject = path.join(tempRoot, 'PulseChat');
const excludedRoots = new Set(['node_modules', '.expo', 'android', 'ios', '.supabase']);

function copyFilter(sourcePath) {
  const relative = path.relative(projectRoot, sourcePath);
  if (!relative) return true;
  const first = relative.split(path.sep)[0];
  if (excludedRoots.has(first) || first.startsWith('dist-')) return false;
  if (sourceOnly && (relative === '.env' || relative === 'google-services.json')) return false;
  return true;
}

function requireMatch(filePath, pattern, message, failures) {
  if (!fs.existsSync(filePath) || !pattern.test(fs.readFileSync(filePath, 'utf8'))) failures.push(message);
}

try {
  fs.cpSync(projectRoot, tempProject, { recursive: true, filter: copyFilter });
  fs.symlinkSync(
    path.join(projectRoot, 'node_modules'),
    path.join(tempProject, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const expoCli = path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
  const environment = {
    ...process.env,
    EXPO_OFFLINE: process.env.EXPO_OFFLINE ?? '1',
    PULSECHAT_BUILD_PROFILE: sourceOnly ? 'source-smoke' : 'configured-smoke',
    PULSECHAT_REQUIRE_PRIVATE_CONFIG: sourceOnly ? '0' : '1',
  };
  if (sourceOnly) delete environment.GOOGLE_SERVICES_JSON;

  const prebuild = spawnSync(process.execPath, [expoCli, 'prebuild', '--platform', 'android', '--no-install'], {
    cwd: tempProject,
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (prebuild.error) {
    throw new Error(`Unable to start Expo Android prebuild: ${prebuild.error.message}`);
  }
  if (prebuild.status !== 0) {
    process.stderr.write(prebuild.stdout ?? '');
    process.stderr.write(prebuild.stderr ?? '');
    throw new Error(`Expo Android prebuild exited with status ${prebuild.status}.`);
  }

  const failures = [];
  const androidRoot = path.join(tempProject, 'android');
  requireMatch(path.join(androidRoot, 'app', 'build.gradle'), /applicationId\s+["']com\.prakashdash\.pulsechat["']/, 'Generated Gradle applicationId is incorrect.', failures);
  requireMatch(path.join(androidRoot, 'app', 'build.gradle'), /versionCode\s+24\b/, 'Generated Gradle versionCode is not 24.', failures);
  requireMatch(path.join(androidRoot, 'app', 'build.gradle'), /versionName\s+["']1\.0\.0["']/, 'Generated Gradle versionName is not 1.0.0.', failures);
  requireMatch(path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml'), /android\.permission\.CAMERA/, 'Generated manifest is missing CAMERA.', failures);
  requireMatch(path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml'), /android\.permission\.POST_NOTIFICATIONS/, 'Generated manifest is missing POST_NOTIFICATIONS.', failures);
  requireMatch(path.join(androidRoot, 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml'), /adaptive-icon/, 'Generated adaptive launcher icon is missing.', failures);

  const resourceRoot = path.join(androidRoot, 'app', 'src', 'main', 'res');
  const notificationDrawables = fs.existsSync(resourceRoot)
    ? fs.readdirSync(resourceRoot, { recursive: true })
      .map((name) => String(name).split(path.sep).join('/'))
    : [];
  if (!notificationDrawables.some((name) => /drawable-[^/]+\/notification_icon\.png$/.test(name))) {
    failures.push('Generated Android resources do not contain the configured notification icon.');
  }

  if (!sourceOnly) {
    if (!fs.existsSync(path.join(androidRoot, 'app', 'google-services.json'))) failures.push('Configured native prebuild did not copy google-services.json.');
    requireMatch(path.join(androidRoot, 'app', 'build.gradle'), /com\.google\.gms\.google-services/, 'Configured Gradle app is missing the Google Services plugin.', failures);
  }

  failures.forEach((failure) => process.stderr.write(`[FAIL] ${failure}\n`));
  if (failures.length > 0) process.exitCode = 1;
  else {
    process.stdout.write(`[PASS] Android native prebuild generated ${sourceOnly ? 'source-only' : 'configured'} release inputs.\n`);
    process.stdout.write('[PASS] applicationId, version, permissions, adaptive icon, notification icon, and Firebase wiring are consistent.\n');
  }
} catch (error) {
  process.stderr.write(`[FAIL] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

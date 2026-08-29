#!/usr/bin/env node

import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  parseDotEnv,
  validateGoogleServices,
  validateSupabaseEnvironment,
} from './phase22-preflight.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function readPngMetadata(filePath) {
  const bytes = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 26 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`${filePath} is not a valid PNG file.`);
  }
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error(`${filePath} does not start with a PNG IHDR chunk.`);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

export function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function profileErrors(profileName, profile, buildType, distribution) {
  const errors = [];
  if (profile?.android?.buildType !== buildType) {
    errors.push(`${profileName} must produce Android ${buildType}.`);
  }
  if (profile?.distribution !== distribution) {
    errors.push(`${profileName} distribution must be ${distribution}.`);
  }
  if (profile?.credentialsSource !== 'remote') {
    errors.push(`${profileName} must use EAS remote signing credentials.`);
  }
  if (profile?.env?.PULSECHAT_REQUIRE_PRIVATE_CONFIG !== '1') {
    errors.push(`${profileName} must fail closed when private build configuration is absent.`);
  }
  if (profile?.env?.PULSECHAT_BUILD_PROFILE !== profileName) {
    errors.push(`${profileName} must identify itself through PULSECHAT_BUILD_PROFILE.`);
  }
  return errors;
}

export function validateReleaseIdentity({ appJson, easJson, packageJson, baseline }) {
  const errors = [];
  const expo = appJson.expo ?? {};
  const android = expo.android ?? {};

  if (android.package !== baseline.applicationId) errors.push('Android application ID differs from the release baseline.');
  if (expo.version !== baseline.versionName) errors.push('Expo version differs from the release baseline.');
  if (packageJson.version !== baseline.versionName) errors.push('package.json version differs from the release baseline.');
  if (!Number.isInteger(android.versionCode) || android.versionCode < 1) errors.push('Android versionCode must be a positive integer.');
  if (android.versionCode !== baseline.versionCode) errors.push('Android versionCode differs from the release baseline.');
  if (expo.extra?.eas?.projectId !== baseline.easProjectId) errors.push('EAS project ID differs from the release baseline.');
  if (easJson.cli?.version !== baseline.easCliVersion) errors.push('EAS CLI version must be exact and match the release baseline.');
  if (easJson.cli?.appVersionSource !== 'local') errors.push('EAS appVersionSource must be local for source-controlled versioning.');
  if (packageJson.devDependencies?.['eas-cli'] !== baseline.easCliVersion) errors.push('The locked eas-cli dev dependency must match the release baseline exactly.');
  if (packageJson.packageManager !== 'npm@11.9.0') errors.push('The package manager must remain pinned to npm 11.9.0.');

  errors.push(...profileErrors('development', easJson.build?.development, 'apk', 'internal'));
  errors.push(...profileErrors('preview', easJson.build?.preview, 'apk', 'internal'));
  errors.push(...profileErrors('production', easJson.build?.production, 'app-bundle', 'store'));
  if (easJson.build?.production?.autoIncrement !== false) {
    errors.push('Production autoIncrement must be false; update the committed versionCode deliberately.');
  }

  const notificationPlugin = expo.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications');
  if (notificationPlugin?.[1]?.defaultChannel !== 'messages') errors.push('Notification default channel must remain messages.');
  if (notificationPlugin?.[1]?.icon !== './assets/images/notification-icon-phase24.png') errors.push('Phase 24 notification icon is not configured.');
  if (android.adaptiveIcon?.foregroundImage !== './assets/images/android-icon-foreground-phase24.png') errors.push('Phase 24 adaptive foreground is not configured.');
  if (android.adaptiveIcon?.monochromeImage !== './assets/images/android-icon-monochrome-phase24.png') errors.push('Phase 24 monochrome icon is not configured.');
  if (android.adaptiveIcon?.backgroundImage) errors.push('Adaptive icon must use a solid background color, not a baked guideline image.');
  if (expo.icon !== './assets/images/icon-phase24.png') errors.push('Phase 24 legacy launcher icon is not configured.');
  if (!android.permissions?.includes('android.permission.CAMERA')) errors.push('Android camera permission is missing.');
  if (!android.permissions?.includes('android.permission.POST_NOTIFICATIONS')) errors.push('Android notification permission is missing.');

  return errors;
}

export function auditRelease(root = projectRoot, { sourceOnly = false } = {}) {
  const failures = [];
  const warnings = [];
  const appJson = readJson(root, 'app.json');
  const easJson = readJson(root, 'eas.json');
  const packageJson = readJson(root, 'package.json');
  const packageLock = readJson(root, 'package-lock.json');
  const baseline = readJson(root, 'release/android-release-baseline.json');
  const secureEnvelope = readText(root, 'src/utils/secure-envelope.js');

  failures.push(...validateReleaseIdentity({ appJson, easJson, packageJson, baseline }));

  if (packageLock.lockfileVersion !== 3) failures.push('package-lock.json must use lockfileVersion 3.');
  if (packageLock.packages?.['']?.devDependencies?.['eas-cli'] !== baseline.easCliVersion) {
    failures.push('package-lock.json must pin the baseline eas-cli version at the project root.');
  }
  const nobleRuntime = baseline.runtimeBundles?.nobleCiphers;
  if (!secureEnvelope.includes("require('../vendor/noble-ciphers-runtime.js')")) {
    failures.push('Secure-envelope crypto must use the local Metro-safe runtime bundle.');
  }
  if (!nobleRuntime?.path || !fs.existsSync(path.join(root, nobleRuntime.path))) {
    failures.push('The local noble-ciphers runtime bundle is missing.');
  } else if (sha256(path.join(root, nobleRuntime.path)) !== nobleRuntime.sha256) {
    failures.push('The local noble-ciphers runtime bundle differs from the reviewed release baseline.');
  }
  if (!nobleRuntime?.licensePath || !fs.existsSync(path.join(root, nobleRuntime.licensePath))) {
    failures.push('The noble-ciphers MIT license notice is missing.');
  }
  if (packageJson.dependencies?.['@noble/ciphers'] !== nobleRuntime?.dependencyVersion
    || packageLock.packages?.['']?.dependencies?.['@noble/ciphers'] !== nobleRuntime?.dependencyVersion) {
    failures.push('The noble-ciphers source dependency must match the bundled runtime baseline.');
  }
  if (packageJson.devDependencies?.esbuild !== nobleRuntime?.builderVersion
    || packageLock.packages?.['']?.devDependencies?.esbuild !== nobleRuntime?.builderVersion) {
    failures.push('The esbuild runtime-bundle builder must match the release baseline.');
  }

  for (const [name, asset] of Object.entries(baseline.assets ?? {})) {
    const assetPath = path.join(root, asset.path);
    if (!fs.existsSync(assetPath)) {
      failures.push(`${name} release asset is missing: ${asset.path}`);
      continue;
    }
    try {
      const metadata = readPngMetadata(assetPath);
      if (metadata.width !== asset.width || metadata.height !== asset.height) {
        failures.push(`${name} dimensions are ${metadata.width}x${metadata.height}; expected ${asset.width}x${asset.height}.`);
      }
      if (['adaptiveForeground', 'adaptiveMonochrome', 'notification', 'splash'].includes(name)
        && ![4, 6].includes(metadata.colorType)) {
        failures.push(`${name} must retain a PNG alpha channel.`);
      }
      if (sha256(assetPath) !== asset.sha256) failures.push(`${name} SHA-256 differs from the reviewed release baseline.`);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  const easIgnore = readText(root, '.easignore');
  for (const protectedPattern of ['.env', 'google-services.json', '*.jks', '*.keystore', '*service-account*.json']) {
    if (!easIgnore.includes(protectedPattern)) failures.push(`.easignore must exclude ${protectedPattern}.`);
  }

  const requiredDocs = [
    'PHASE24_README.txt',
    'docs/PHASE24_RELEASE_RUNBOOK.md',
    'docs/PHASE24_ACCEPTANCE.md',
    'supabase/migrations/202608290018_phase24_rate_limit_ambiguity_fix.sql',
    'supabase/phase24_verify.sql',
  ];
  for (const relativePath of requiredDocs) {
    if (!fs.existsSync(path.join(root, relativePath))) failures.push(`Required Phase 24 document is missing: ${relativePath}`);
  }

  const envPath = path.join(root, '.env');
  const googlePath = path.join(root, 'google-services.json');
  if (!fs.existsSync(envPath)) {
    const message = '.env is absent; EAS environments must provide both public Supabase client values.';
    if (sourceOnly) warnings.push(message); else failures.push(message);
  } else {
    failures.push(...validateSupabaseEnvironment(parseDotEnv(fs.readFileSync(envPath, 'utf8'))));
  }

  if (!fs.existsSync(googlePath)) {
    const message = 'google-services.json is absent; configure GOOGLE_SERVICES_JSON as an EAS file variable.';
    if (sourceOnly) warnings.push(message); else failures.push(message);
  } else {
    failures.push(...validateGoogleServices(readJson(root, 'google-services.json'), baseline.applicationId));
  }

  if (!sourceOnly) {
    const priorRequirePrivate = process.env.PULSECHAT_REQUIRE_PRIVATE_CONFIG;
    process.env.PULSECHAT_REQUIRE_PRIVATE_CONFIG = '1';
    try {
      const buildConfig = require(path.join(root, 'app.config.js'));
      const resolved = buildConfig({ config: appJson.expo });
      if (!resolved.android?.googleServicesFile) failures.push('Resolved release config has no Firebase Android file.');
    } catch (error) {
      failures.push(`Release app config failed closed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (priorRequirePrivate === undefined) delete process.env.PULSECHAT_REQUIRE_PRIVATE_CONFIG;
      else process.env.PULSECHAT_REQUIRE_PRIVATE_CONFIG = priorRequirePrivate;
    }
  }

  return { failures, warnings, identity: baseline };
}

function run() {
  const sourceOnly = process.argv.includes('--source-only');
  const { failures, warnings, identity } = auditRelease(projectRoot, { sourceOnly });
  if (failures.length === 0) {
    process.stdout.write(`[PASS] ${identity.applicationId} ${identity.versionName} (${identity.versionCode}) release identity is consistent.\n`);
    process.stdout.write('[PASS] EAS profiles, signing source, Firebase fail-closed behavior, permissions, and reviewed assets are consistent.\n');
  }
  warnings.forEach((warning) => process.stdout.write(`[WARN] ${warning}\n`));
  failures.forEach((failure) => process.stdout.write(`[FAIL] ${failure}\n`));
  process.stdout.write(`Phase 24 release audit: ${failures.length} failure(s), ${warnings.length} warning(s).\n`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();

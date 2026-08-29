#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseDotEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function validateSupabaseEnvironment(values) {
  const errors = [];
  const urlValue = values.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const keyValue = values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  if (!urlValue || /YOUR_PROJECT_REF|REPLACE_ME/i.test(urlValue)) {
    errors.push('EXPO_PUBLIC_SUPABASE_URL is missing or still uses the example placeholder.');
  } else {
    try {
      const parsed = new URL(urlValue);
      if (parsed.protocol !== 'https:') errors.push('EXPO_PUBLIC_SUPABASE_URL must use HTTPS for device QA.');
    } catch {
      errors.push('EXPO_PUBLIC_SUPABASE_URL is not a valid URL.');
    }
  }

  if (!keyValue || /REPLACE_ME|placeholder/i.test(keyValue)) {
    errors.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing or still uses the example placeholder.');
  } else if (/service[_-]?role|secret/i.test(keyValue)) {
    errors.push('The client environment appears to contain a server/service-role secret.');
  }

  return errors;
}

export function validateGoogleServices(config, expectedPackage) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['google-services.json is not a JSON object.'];

  const projectId = config.project_info?.project_id;
  if (typeof projectId !== 'string' || !projectId.trim()) {
    errors.push('google-services.json does not contain project_info.project_id.');
  }

  const clients = Array.isArray(config.client) ? config.client : [];
  const androidClient = clients.find((client) => (
    client?.client_info?.android_client_info?.package_name === expectedPackage
  ));
  if (!androidClient) {
    errors.push(`google-services.json has no Android client for ${expectedPackage}.`);
  } else {
    const apiKeys = Array.isArray(androidClient.api_key) ? androidClient.api_key : [];
    if (!apiKeys.some((entry) => typeof entry?.current_key === 'string' && entry.current_key.trim())) {
      errors.push('The matching Firebase Android client has no API key.');
    }
  }

  return errors;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function run() {
  const sourceOnly = process.argv.includes('--source-only');
  const results = [];
  const pass = (message) => results.push({ level: 'PASS', message });
  const warn = (message) => results.push({ level: 'WARN', message });
  const fail = (message) => results.push({ level: 'FAIL', message });

  const requiredFiles = [
    'package-lock.json',
    'app.json',
    'app.config.js',
    'eas.json',
    'supabase/migrations/202608280017_phase21_security_hardening.sql',
    'supabase/phase21_verify.sql',
    'supabase/functions/send-message-push/index.ts',
    'supabase/functions/delete-account/index.ts',
  ];
  const missingFiles = requiredFiles.filter((file) => !exists(file));
  if (missingFiles.length === 0) pass('Required V1 source, migration, verification, and Edge Function files are present.');
  else missingFiles.forEach((file) => fail(`Required file is missing: ${file}`));

  try {
    const packageJson = readJson('package.json');
    const requiredScripts = ['verify:security', 'check:android', 'check:web', 'qa:preflight'];
    const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);
    if (missingScripts.length === 0) pass('Phase 22 package scripts are available.');
    else missingScripts.forEach((script) => fail(`package.json script is missing: ${script}`));
  } catch (error) {
    fail(`package.json could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let androidPackage = '';
  try {
    const appJson = readJson('app.json');
    const expo = appJson.expo ?? {};
    androidPackage = expo.android?.package ?? '';
    if (androidPackage === 'com.prakashdash.pulsechat') pass(`Android package is ${androidPackage}.`);
    else fail('Android package must remain com.prakashdash.pulsechat for the configured Prototype V1 Firebase app.');

    const projectId = expo.extra?.eas?.projectId;
    if (typeof projectId === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId)) {
      pass('Expo EAS project ID is configured.');
    } else {
      fail('Expo EAS project ID is missing or invalid.');
    }

    const notificationPlugin = Array.isArray(expo.plugins)
      ? expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications')
      : null;
    if (notificationPlugin?.[1]?.defaultChannel === 'messages') pass('Android message notification channel is configured.');
    else fail('expo-notifications must use the messages default channel.');
  } catch (error) {
    fail(`app.json could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const eas = readJson('eas.json');
    if (eas.build?.preview?.distribution === 'internal') pass('EAS preview builds use internal distribution.');
    else fail('The EAS preview profile must use internal distribution for two-phone QA.');
  } catch (error) {
    fail(`eas.json could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) {
    const message = '.env is absent; create it from .env.example before connected device QA.';
    if (sourceOnly) warn(message); else fail(message);
  } else {
    const envErrors = validateSupabaseEnvironment(parseDotEnv(fs.readFileSync(envPath, 'utf8')));
    if (envErrors.length === 0) pass('Client Supabase environment is present and structurally valid.');
    else envErrors.forEach(fail);
  }

  const firebasePath = path.join(projectRoot, 'google-services.json');
  if (!fs.existsSync(firebasePath)) {
    const message = 'google-services.json is absent; add the private Firebase Android config before push-enabled builds.';
    if (sourceOnly) warn(message); else fail(message);
  } else {
    try {
      const firebaseErrors = validateGoogleServices(JSON.parse(fs.readFileSync(firebasePath, 'utf8')), androidPackage);
      if (firebaseErrors.length === 0) pass('Firebase Android config matches the PulseChat application ID.');
      else firebaseErrors.forEach(fail);
    } catch (error) {
      fail(`google-services.json could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  results.forEach(({ level, message }) => process.stdout.write(`[${level}] ${message}\n`));
  const failures = results.filter((result) => result.level === 'FAIL').length;
  const warnings = results.filter((result) => result.level === 'WARN').length;
  process.stdout.write(`Phase 22 preflight: ${failures} failure(s), ${warnings} warning(s).\n`);
  if (failures > 0) process.exitCode = 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) run();

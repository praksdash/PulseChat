#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2];
const outputDirectory = process.argv[3];

if (!['android', 'web'].includes(platform) || !/^dist-phase(?:24|25|26|27-4)-[a-z0-9-]+$/i.test(outputDirectory ?? '')) {
  process.stderr.write('Usage: node scripts/phase24-expo-export.mjs <android|web> <dist-phase24-*|dist-phase25-*|dist-phase26-*|dist-phase27-4-* directory>\n');
  process.exit(1);
}

const expoCli = path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
const result = spawnSync(process.execPath, [
  expoCli,
  'export',
  '--platform',
  platform,
  '--output-dir',
  outputDirectory,
], {
  cwd: projectRoot,
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    EXPO_OFFLINE: '1',
  },
  stdio: 'inherit',
});

if (result.error) {
  throw new Error(`Unable to start Expo ${platform} export: ${result.error.message}`);
}
process.exit(result.status ?? 1);

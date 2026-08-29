#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2];
const outputDirectory = process.argv[3];

if (!['android', 'web'].includes(platform) || !/^dist-phase(?:24|25)-[a-z0-9-]+$/i.test(outputDirectory ?? '')) {
  process.stderr.write('Usage: node scripts/phase24-expo-export.mjs <android|web> <dist-phase24-*|dist-phase25-* directory>\n');
  process.exit(1);
}

const expoBin = path.join(projectRoot, 'node_modules', '.bin', 'expo');
const result = spawnSync(expoBin, ['export', '--platform', platform, '--output-dir', outputDirectory], {
  cwd: projectRoot,
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    EXPO_OFFLINE: '1',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

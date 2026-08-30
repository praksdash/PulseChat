import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditCallNative } from '../scripts/phase27-4-call-native-audit.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Phase 27.4 native calling configuration audit passes', () => {
  assert.deepEqual(auditCallNative(projectRoot).failures, []);
});

test('Phase 27.4 permission adapter blocks only required media access', () => {
  const runtime = read('src/services/call-media-runtime.native.ts');
  assert.match(runtime, /const permissions: Permission\[\] = \[microphonePermission\]/);
  assert.match(runtime, /if \(kind === 'video'\) permissions\.push\(cameraPermission\)/);
  assert.match(runtime, /Number\(Platform\.Version\) >= 31/);
  assert.match(runtime, /Bluetooth permission is optional/);
  assert.match(runtime, /canStart: microphone === 'granted' && cameraReady/);
});

test('Phase 27.4 initializes media without prompting on startup', () => {
  const rootLayout = read('src/app/_layout.tsx');
  assert.match(rootLayout, /initializeCallMediaRuntime\(\)/);
  assert.doesNotMatch(rootLayout, /requestCallPermissions\(/);
});

test('Phase 27.4 keeps native WebRTC out of the Web fallback', () => {
  const fallback = read('src/services/call-media-runtime.ts');
  assert.doesNotMatch(fallback, /@livekit\/react-native/);
  assert.match(fallback, /supported: false/);
  assert.match(fallback, /Calling is supported only in the PulseChat Android build/);
});


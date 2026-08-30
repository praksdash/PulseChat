#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const expectedDependencies = {
  '@config-plugins/react-native-webrtc': '15.0.2',
  '@livekit/react-native': '2.12.0',
  '@livekit/react-native-expo-plugin': '1.0.2',
  '@livekit/react-native-webrtc': '144.1.2',
  'livekit-client': '2.22.1',
};

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function auditCallNative(root = projectRoot) {
  const failures = [];
  const appJson = readJson(root, 'app.json');
  const packageJson = readJson(root, 'package.json');
  const packageLock = readJson(root, 'package-lock.json');
  const expo = appJson.expo ?? {};
  const android = expo.android ?? {};

  for (const [dependency, version] of Object.entries(expectedDependencies)) {
    if (packageJson.dependencies?.[dependency] !== version) {
      failures.push(`${dependency} must be pinned to ${version}.`);
    }
    if (packageLock.packages?.['']?.dependencies?.[dependency] !== version) {
      failures.push(`The lockfile root must pin ${dependency} to ${version}.`);
    }
    if (packageLock.packages?.[`node_modules/${dependency}`]?.version !== version) {
      failures.push(`The installed lockfile entry for ${dependency} must be ${version}.`);
    }
  }

  const liveKitPlugin = expo.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === '@livekit/react-native-expo-plugin',
  );
  if (liveKitPlugin?.[1]?.android?.audioType !== 'communication') {
    failures.push('LiveKit Android audio must use the communication preset.');
  }
  if (liveKitPlugin?.[1]?.android?.enableScreenShareService !== false) {
    failures.push('LiveKit screen-sharing service must remain disabled.');
  }

  const webRtcPlugin = expo.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === '@config-plugins/react-native-webrtc',
  );
  if (!webRtcPlugin?.[1]?.cameraPermission?.includes('video calls')) {
    failures.push('The camera permission copy must explain video calling.');
  }
  if (!webRtcPlugin?.[1]?.microphonePermission?.includes('voice and video calls')) {
    failures.push('The microphone permission copy must explain calling.');
  }

  for (const permission of [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.POST_NOTIFICATIONS',
  ]) {
    if (!android.permissions?.includes(permission)) {
      failures.push(`Android calling configuration is missing ${permission}.`);
    }
  }
  for (const forbidden of [
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  ]) {
    if (!android.blockedPermissions?.includes(forbidden)) {
      failures.push(`Android must block unused sensitive permission ${forbidden}.`);
    }
  }

  const nativeRuntime = read(root, 'src/services/call-media-runtime.native.ts');
  const fallbackRuntime = read(root, 'src/services/call-media-runtime.ts');
  const rootLayout = read(root, 'src/app/_layout.tsx');
  if (!nativeRuntime.includes("from '@livekit/react-native'")) {
    failures.push('The Android runtime adapter does not use the pinned LiveKit SDK.');
  }
  if (!nativeRuntime.includes('registerGlobals()')) {
    failures.push('The Android runtime adapter does not register WebRTC globals.');
  }
  if (!nativeRuntime.includes('PermissionsAndroid.requestMultiple(permissions)')) {
    failures.push('The Android runtime adapter has no explicit call permission request.');
  }
  if (!nativeRuntime.includes('AudioSession.startAudioSession()')
      || !nativeRuntime.includes('AudioSession.stopAudioSession()')) {
    failures.push('The Android runtime adapter must bound the communication audio session.');
  }
  if (fallbackRuntime.includes('@livekit/react-native')) {
    failures.push('The Web fallback must not import the native LiveKit package.');
  }
  if (!rootLayout.includes('initializeCallMediaRuntime();')) {
    failures.push('The root layout must register native WebRTC globals before call use.');
  }
  if (rootLayout.includes('requestCallPermissions(')) {
    failures.push('Call permissions must not be requested during app startup.');
  }

  return { failures };
}

function run() {
  const { failures } = auditCallNative(projectRoot);
  failures.forEach((failure) => process.stdout.write(`[FAIL] ${failure}\n`));
  if (failures.length === 0) {
    process.stdout.write('[PASS] Phase 27.4 LiveKit dependencies and Expo plugins are pinned.\n');
    process.stdout.write('[PASS] Android call permissions, Web isolation, and bounded audio runtime are configured.\n');
  }
  process.stdout.write(`Phase 27.4 call-native audit: ${failures.length} failure(s).\n`);
  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();


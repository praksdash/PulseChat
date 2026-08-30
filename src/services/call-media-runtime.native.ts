import { AudioSession, registerGlobals } from '@livekit/react-native';
import {
  PermissionsAndroid,
  Platform,
  type Permission,
  type PermissionStatus,
} from 'react-native';

import type {
  CallMediaKind,
  CallPermissionResult,
  CallPermissionState,
} from '@/types/call-media';

let globalsRegistered = false;
let audioSessionStarted = false;
let audioStartPromise: Promise<void> | null = null;

const microphonePermission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
const cameraPermission = PermissionsAndroid.PERMISSIONS.CAMERA;
const bluetoothPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as Permission;

function isAndroidTwelveOrNewer() {
  return Platform.OS === 'android' && Number(Platform.Version) >= 31;
}

function fromRequestStatus(status: PermissionStatus | undefined): CallPermissionState {
  if (status === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

async function checkedState(permission: Permission): Promise<CallPermissionState> {
  return await PermissionsAndroid.check(permission) ? 'granted' : 'denied';
}

function resultFor(
  kind: CallMediaKind,
  microphone: CallPermissionState,
  camera: CallPermissionState,
  bluetooth: CallPermissionState,
): CallPermissionResult {
  const cameraReady = kind === 'voice' || camera === 'granted';
  return {
    supported: Platform.OS === 'android',
    microphone,
    camera,
    bluetooth,
    // Bluetooth permission is optional; denial falls back to the phone audio
    // route. Microphone and video-camera access are the only start blockers.
    canStart: microphone === 'granted' && cameraReady,
  };
}

export function initializeCallMediaRuntime() {
  if (globalsRegistered) return;
  registerGlobals();
  globalsRegistered = true;
}

export function isCallMediaRuntimeSupported() {
  return Platform.OS === 'android';
}

export async function getCallPermissionStatus(
  kind: CallMediaKind,
): Promise<CallPermissionResult> {
  if (Platform.OS !== 'android') {
    return {
      supported: false,
      microphone: 'unsupported',
      camera: 'unsupported',
      bluetooth: 'unsupported',
      canStart: false,
    };
  }

  const [microphone, camera, bluetooth] = await Promise.all([
    checkedState(microphonePermission),
    kind === 'video' ? checkedState(cameraPermission) : Promise.resolve('not_required' as const),
    isAndroidTwelveOrNewer()
      ? checkedState(bluetoothPermission)
      : Promise.resolve('not_required' as const),
  ]);
  return resultFor(kind, microphone, camera, bluetooth);
}

export async function requestCallPermissions(
  kind: CallMediaKind,
): Promise<CallPermissionResult> {
  if (Platform.OS !== 'android') return getCallPermissionStatus(kind);

  const permissions: Permission[] = [microphonePermission];
  if (kind === 'video') permissions.push(cameraPermission);
  if (isAndroidTwelveOrNewer()) permissions.push(bluetoothPermission);

  const statuses = await PermissionsAndroid.requestMultiple(permissions);
  return resultFor(
    kind,
    fromRequestStatus(statuses[microphonePermission]),
    kind === 'video'
      ? fromRequestStatus(statuses[cameraPermission])
      : 'not_required',
    isAndroidTwelveOrNewer()
      ? fromRequestStatus(statuses[bluetoothPermission])
      : 'not_required',
  );
}

export async function startCallAudioSession() {
  initializeCallMediaRuntime();
  if (audioSessionStarted) return;
  if (audioStartPromise) return audioStartPromise;

  audioStartPromise = AudioSession.startAudioSession()
    .then(() => {
      audioSessionStarted = true;
    })
    .finally(() => {
      audioStartPromise = null;
    });
  return audioStartPromise;
}

export async function stopCallAudioSession() {
  if (audioStartPromise) await audioStartPromise.catch(() => undefined);
  if (!audioSessionStarted) return;
  await AudioSession.stopAudioSession();
  audioSessionStarted = false;
}


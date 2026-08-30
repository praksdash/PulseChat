import type { CallMediaKind, CallPermissionResult } from '@/types/call-media';

const unsupportedPermissions: CallPermissionResult = {
  supported: false,
  microphone: 'unsupported',
  camera: 'unsupported',
  bluetooth: 'unsupported',
  canStart: false,
};

// Metro selects call-media-runtime.native.ts for Android. This fallback keeps
// Web/static rendering free of native WebRTC imports and explicitly avoids
// claiming Web calling in the Android-only Phase 27 scope.
export function initializeCallMediaRuntime() {}

export function isCallMediaRuntimeSupported() {
  return false;
}

export async function getCallPermissionStatus(
  _kind: CallMediaKind,
): Promise<CallPermissionResult> {
  return unsupportedPermissions;
}

export async function requestCallPermissions(
  _kind: CallMediaKind,
): Promise<CallPermissionResult> {
  return unsupportedPermissions;
}

export async function startCallAudioSession() {
  throw new Error('Calling is supported only in the PulseChat Android build.');
}

export async function stopCallAudioSession() {}


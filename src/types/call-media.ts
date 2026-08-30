export type CallMediaKind = 'voice' | 'video';

export type CallPermissionState =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'not_required'
  | 'unsupported';

export type CallPermissionResult = {
  supported: boolean;
  microphone: CallPermissionState;
  camera: CallPermissionState;
  bluetooth: CallPermissionState;
  canStart: boolean;
};


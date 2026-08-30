import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { registerExpoPushToken } from '@/services/push-token-service';

export const MESSAGE_NOTIFICATION_CHANNEL = 'messages';

let activeConversationId: string | null = null;
let notificationHandlerConfigured = false;
let pushRegistrationSuspended = false;
let pushRegistrationInFlight: Promise<PushRegistrationResult> | null = null;
let lastObservedNativePushToken: string | null = null;

const PUSH_TOKEN_TIMEOUT_MS = 15_000;

function getProjectId() {
  const easProjectId = Constants.easConfig?.projectId;
  const configProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const projectId = easProjectId ?? configProjectId;
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
}

export function setActivePushConversation(conversationId: string | null) {
  activeConversationId = conversationId;
}

export function getActivePushConversation() {
  return activeConversationId;
}

export function configurePushNotificationHandler() {
  if (Platform.OS === 'web' || notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const incomingConversationId = typeof data?.conversationId === 'string'
        ? data.conversationId
        : null;
      const shouldPresent = !incomingConversationId || incomingConversationId !== activeConversationId;

      return {
        shouldPlaySound: shouldPresent,
        shouldSetBadge: true,
        shouldShowBanner: shouldPresent,
        shouldShowList: shouldPresent,
      };
    },
  });
}

async function ensureAndroidMessageChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(MESSAGE_NOTIFICATION_CHANNEL, {
    name: 'Messages',
    description: 'New PulseChat direct and group messages',
    importance: Notifications.AndroidImportance.HIGH,
    // Do not pass the literal string `default` here. In current expo-notifications
    // releases the Android channel API validates a string sound value as a
    // bundled custom sound filename. Omitting `sound` lets Android use the
    // channel's normal system notification sound behavior without requiring a
    // bundled .wav asset.
    vibrationPattern: [0, 180, 100, 180],
    enableVibrate: true,
    showBadge: true,
  });
}

export function suspendPushRegistration() {
  pushRegistrationSuspended = true;
}

export function resumePushRegistration() {
  pushRegistrationSuspended = false;
}

export type PushRegistrationResult =
  | { status: 'unsupported' }
  | { status: 'suspended' }
  | { status: 'denied' }
  | { status: 'registered'; token: string };

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function performPushRegistration(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') return { status: 'unsupported' };
  if (pushRegistrationSuspended) return { status: 'suspended' };

  configurePushNotificationHandler();
  await ensureAndroidMessageChannel();

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    permissions = await Notifications.requestPermissionsAsync();
  }

  if (permissions.status !== 'granted') {
    return { status: 'denied' };
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('Expo EAS projectId is missing from app.json.');
  }

  const token = (await withTimeout(
    Notifications.getExpoPushTokenAsync({ projectId }),
    PUSH_TOKEN_TIMEOUT_MS,
    'Push registration timed out. Check the connection and try again.',
  )).data;
  await registerExpoPushToken({
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceName: Device.deviceName ?? Device.modelName ?? null,
    appVersion: Constants.expoConfig?.version ?? null,
  });

  return { status: 'registered', token };
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (pushRegistrationInFlight) return pushRegistrationInFlight;

  const registration = performPushRegistration();
  pushRegistrationInFlight = registration;
  try {
    return await registration;
  } finally {
    if (pushRegistrationInFlight === registration) pushRegistrationInFlight = null;
  }
}

function nativePushTokenKey(token: Notifications.DevicePushToken) {
  const data = typeof token.data === 'string' ? token.data : JSON.stringify(token.data);
  return `${token.type}:${data}`;
}

export function subscribeToNativePushTokenChanges(onError?: (error: unknown) => void) {
  if (Platform.OS === 'web') return () => undefined;

  const subscription = Notifications.addPushTokenListener((token) => {
    const tokenKey = nativePushTokenKey(token);
    if (lastObservedNativePushToken === tokenKey) return;
    lastObservedNativePushToken = tokenKey;

    // Expo documents that the underlying native token can rotate while the app
    // is running. Registration is single-flighted and duplicate native-token
    // events are ignored so a backend error cannot create a retry storm.
    void registerForPushNotifications().catch((error) => {
      onError?.(error);
    });
  });

  return () => subscription.remove();
}

export function subscribeToNotificationResponses(
  listener: (response: Notifications.NotificationResponse) => void,
) {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener(listener);
  return () => subscription.remove();
}

export function subscribeToForegroundNotifications(
  listener: (notification: Notifications.Notification) => void,
) {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationReceivedListener(listener);
  return () => subscription.remove();
}

export async function getLastNotificationResponse() {
  if (Platform.OS === 'web') return null;
  return Notifications.getLastNotificationResponseAsync();
}

export async function clearLastNotificationResponse() {
  if (Platform.OS === 'web') return;
  await Notifications.clearLastNotificationResponseAsync();
}


export type NativeNotificationStatus = {
  supported: boolean;
  permission: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  registeredDevices: number;
  latestRegistrationAt: string | null;
  registrationError: string | null;
};

export async function getNativeNotificationStatus(): Promise<NativeNotificationStatus> {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      permission: 'unsupported',
      registeredDevices: 0,
      latestRegistrationAt: null,
      registrationError: null,
    };
  }

  const permissions = await Notifications.getPermissionsAsync();
  const { data, error } = await supabase
    .from('push_tokens')
    .select('enabled,last_registered_at')
    .eq('enabled', true)
    .order('last_registered_at', { ascending: false });

  const permission = permissions.status === 'granted'
    ? 'granted'
    : permissions.status === 'denied'
      ? 'denied'
      : 'undetermined';

  return {
    supported: true,
    permission,
    registeredDevices: data?.length ?? 0,
    latestRegistrationAt: data?.[0]?.last_registered_at ?? null,
    registrationError: error?.message ?? null,
  };
}

export async function sendLocalTestNotification() {
  if (Platform.OS === 'web') throw new Error('Native test notifications are unavailable on web.');
  configurePushNotificationHandler();
  await ensureAndroidMessageChannel();

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') {
    throw new Error('Notification permission is not granted.');
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'PulseChat test',
      body: 'Notifications are enabled on this device.',
      data: { type: 'test' },
    },
    trigger: null,
  });
}

export async function sendRemoteTestNotification() {
  if (Platform.OS === 'web') throw new Error('Remote Expo push tests are for Android/iOS devices.');
  const registration = await registerForPushNotifications();
  if (registration.status !== 'registered') {
    throw new Error(registration.status === 'denied'
      ? 'Notification permission is denied.'
      : 'This device could not register for remote notifications.');
  }

  const { data, error } = await supabase.functions.invoke('send-message-push', {
    body: { action: 'test' },
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? 'Remote push test failed.');
  return data as { ok: boolean; sent: number; errors: number; details?: string[] };
}

export async function unregisterNativePushNotifications() {
  if (Platform.OS === 'web') return;
  await Notifications.unregisterForNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

export async function syncApplicationBadge() {
  if (Platform.OS === 'web') return;

  const { data, error } = await supabase.rpc('get_my_total_unread_count', {});
  if (error) throw new Error(error.message);
  const count = typeof data === 'number' && Number.isFinite(data) ? Math.max(0, Math.trunc(data)) : 0;
  await Notifications.setBadgeCountAsync(count);
}

configurePushNotificationHandler();

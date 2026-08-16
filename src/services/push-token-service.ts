import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const PUSH_TOKEN_STORAGE_KEY = 'pulsechat:last-expo-push-token';

export async function getStoredExpoPushToken() {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function registerExpoPushToken(input: {
  token: string;
  platform: 'android' | 'ios';
  deviceName?: string | null;
  appVersion?: string | null;
}) {
  const previousToken = await getStoredExpoPushToken();

  // Token rotation is rare, but the old registration should not continue to
  // receive notifications after Expo/FCM gives this installation a new token.
  if (previousToken && previousToken !== input.token) {
    const { error: disableError } = await supabase.rpc('disable_my_push_token', {
      target_expo_push_token: previousToken,
    });
    if (disableError) {
      console.warn('Unable to disable rotated push token:', disableError.message);
    }
  }

  const { error } = await supabase.rpc('register_my_push_token', {
    target_expo_push_token: input.token,
    target_platform: input.platform,
    target_device_name: input.deviceName ?? null,
    target_app_version: input.appVersion ?? null,
  });

  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, input.token);
}

export async function disableStoredExpoPushToken() {
  const token = await getStoredExpoPushToken();
  if (!token) return;

  const { error } = await supabase.rpc('disable_my_push_token', {
    target_expo_push_token: token,
  });

  // Always clear the local association. If the network is unavailable the
  // server registration may remain until the device signs in again/rotates;
  // Phase 19 will add an offline mutation queue for that edge case.
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  if (error) throw new Error(error.message);
}

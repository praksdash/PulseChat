import { AppState, Platform } from 'react-native';

const ONLINE_INTERVAL_MS = 30_000;
const OFFLINE_INTERVAL_MS = 8_000;
const REQUEST_TIMEOUT_MS = 5_000;

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export async function probeBackendConnectivity(): Promise<boolean> {
  if (!configuredUrl || !configuredKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${configuredUrl.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: configuredKey,
        Authorization: `Bearer ${configuredKey}`,
      },
      signal: controller.signal,
    });

    // A non-5xx response proves the configured backend is reachable.
    // Authentication/schema errors are handled by the caller that made the real request.
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function getConnectivityPollInterval(isOnline: boolean) {
  return isOnline ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS;
}

export function subscribeToPlatformConnectivityHints(onHint: () => void) {
  const cleanups: Array<() => void> = [];

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onlineHandler = () => onHint();
    const offlineHandler = () => onHint();
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    cleanups.push(() => window.removeEventListener('online', onlineHandler));
    cleanups.push(() => window.removeEventListener('offline', offlineHandler));
  }

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onHint();
  });
  cleanups.push(() => appStateSubscription.remove());

  return () => cleanups.forEach((cleanup) => cleanup());
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  clearBufferedDiagnostics,
  enqueueDiagnostic,
  fingerprintDiagnostic,
  getBufferedDiagnosticCount,
  requeueDiagnostics,
  takeDiagnostics,
} from '@/services/diagnostics-buffer';
import { isRetryableNetworkError } from '@/services/network-error-service';
import type { Json } from '@/types/database';

const applicationStartedAt = Date.now();
let activeUserId: string | null = null;
let startupRecorded = false;
let flushPromise: Promise<void> | null = null;
let globalHandlerInstalled = false;

function getRuntimeContext() {
  const profile = Constants.expoConfig?.extra?.release?.buildProfile;
  return {
    platform: (['android', 'ios', 'web'].includes(Platform.OS) ? Platform.OS : 'unknown') as
      'android' | 'ios' | 'web' | 'unknown',
    appVersion: Constants.expoConfig?.version?.slice(0, 32) || 'unknown',
    buildProfile: typeof profile === 'string' && profile.trim()
      ? profile.trim().slice(0, 32)
      : 'local',
  };
}

export function configureDiagnosticsUser(userId: string | null) {
  if (activeUserId && activeUserId !== userId) clearBufferedDiagnostics();
  activeUserId = userId;
  if (userId) void flushDiagnostics();
}

export function recordStartupReady() {
  if (startupRecorded) return;
  startupRecorded = true;
  const runtime = getRuntimeContext();
  enqueueDiagnostic({
    event_type: 'startup',
    operation: 'app_ready',
    platform: runtime.platform,
    app_version: runtime.appVersion,
    build_profile: runtime.buildProfile,
    duration_ms: Date.now() - applicationStartedAt,
    outcome: 'ok',
    status_code: null,
    error_fingerprint: null,
    occurred_at: new Date().toISOString(),
  });
  void flushDiagnostics();
}

export function captureDiagnosticError(error: unknown, operation = 'unhandled_js') {
  const runtime = getRuntimeContext();
  const errorName = error instanceof Error ? error.name : typeof error;
  const stackShape = error instanceof Error
    ? (error.stack ?? '').split('\n').slice(0, 8).map((line) => line.replace(/:\d+:\d+/g, '')).join('|')
    : '';

  enqueueDiagnostic({
    event_type: 'crash',
    operation,
    platform: runtime.platform,
    app_version: runtime.appVersion,
    build_profile: runtime.buildProfile,
    duration_ms: null,
    outcome: 'error',
    status_code: null,
    error_fingerprint: fingerprintDiagnostic(`${errorName}|${stackShape}`),
    occurred_at: new Date().toISOString(),
  });
  void flushDiagnostics();
}

export async function flushDiagnostics() {
  if (flushPromise) return flushPromise;
  if (!activeUserId || !isSupabaseConfigured || getBufferedDiagnosticCount() === 0) return;

  const batch = takeDiagnostics(20);
  flushPromise = (async () => {
    const { error } = await supabase.rpc('record_client_diagnostics', {
      target_events: batch as unknown as Json,
    });
    if (error && isRetryableNetworkError(error)) requeueDiagnostics(batch);
  })().finally(() => {
    flushPromise = null;
    if (activeUserId && getBufferedDiagnosticCount() > 0) {
      setTimeout(() => void flushDiagnostics(), 1_000);
    }
  });

  return flushPromise;
}

type ErrorUtilsShape = {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

export function installGlobalErrorDiagnostics() {
  if (globalHandlerInstalled || Platform.OS === 'web') return;
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return;

  const priorHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    captureDiagnosticError(error, isFatal ? 'fatal_js' : 'unhandled_js');
    priorHandler(error, isFatal);
  });
  globalHandlerInstalled = true;
}

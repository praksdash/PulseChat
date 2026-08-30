import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import {
  captureDiagnosticError,
  configureDiagnosticsUser,
  flushDiagnostics,
  installGlobalErrorDiagnostics,
  recordStartupReady,
} from '@/services/diagnostics-service';

const FLUSH_INTERVAL_MS = 15_000;

export function DiagnosticsBridge() {
  const { isInitializing, user } = useAuth();

  useEffect(() => {
    installGlobalErrorDiagnostics();
  }, []);

  useEffect(() => {
    configureDiagnosticsUser(user?.id ?? null);
    return () => configureDiagnosticsUser(null);
  }, [user?.id]);

  useEffect(() => {
    if (!isInitializing) recordStartupReady();
  }, [isInitializing]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => void flushDiagnostics(), FLUSH_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushDiagnostics();
    });
    return () => {
      clearInterval(interval);
      appState.remove();
      void flushDiagnostics();
    };
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onError = (event: ErrorEvent) => captureDiagnosticError(event.error, 'web_error');
    const onRejection = (event: PromiseRejectionEvent) => {
      captureDiagnosticError(event.reason, 'unhandled_promise');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

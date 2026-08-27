import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import {
  getConnectivityPollInterval,
  probeBackendConnectivity,
  subscribeToPlatformConnectivityHints,
} from '@/services/connectivity-service';
import type { ConnectivitySnapshot } from '@/types/connectivity';

type ConnectivityContextValue = ConnectivitySnapshot & {
  checkNow: () => Promise<boolean>;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>({
    state: 'checking',
    isOnline: true,
    lastCheckedAt: null,
    lastOnlineAt: null,
  });
  const requestInFlightRef = useRef<Promise<boolean> | null>(null);

  const checkNow = useCallback(async () => {
    if (requestInFlightRef.current) return requestInFlightRef.current;

    const request = probeBackendConnectivity().then((online) => {
      const now = new Date().toISOString();
      setSnapshot((current) => ({
        state: online ? 'online' : 'offline',
        isOnline: online,
        lastCheckedAt: now,
        lastOnlineAt: online ? now : current.lastOnlineAt,
      }));
      return online;
    }).finally(() => {
      requestInFlightRef.current = null;
    });

    requestInFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    void checkNow();
    return subscribeToPlatformConnectivityHints(() => {
      void checkNow();
    });
  }, [checkNow]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkNow();
    }, getConnectivityPollInterval(snapshot.isOnline));
    return () => clearTimeout(timer);
  }, [checkNow, snapshot.isOnline, snapshot.lastCheckedAt]);

  const value = useMemo<ConnectivityContextValue>(() => ({
    ...snapshot,
    checkNow,
  }), [checkNow, snapshot]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used inside ConnectivityProvider.');
  }
  return context;
}

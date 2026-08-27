export type ConnectivityState = 'checking' | 'online' | 'offline';

export type ConnectivitySnapshot = {
  state: ConnectivityState;
  isOnline: boolean;
  lastCheckedAt: string | null;
  lastOnlineAt: string | null;
};

import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { supabase } from '@/lib/supabase';

const LAST_SEEN_HEARTBEAT_MS = 60_000;

export type PeerPresenceState = {
  online: boolean;
  lastSeenAt: string | null;
};

type PresencePayload = {
  user_id?: unknown;
  online_at?: unknown;
  app_state?: unknown;
};

function hasOnlinePeer(channel: RealtimeChannel, peerUserId: string) {
  const state = channel.presenceState() as Record<string, PresencePayload[]>;
  return Object.values(state).some((entries) => entries.some((entry) => (
    entry?.user_id === peerUserId && entry?.app_state === 'active'
  )));
}

export async function touchMyLastSeen() {
  const { data, error } = await supabase.rpc('touch_my_last_seen');
  if (error) throw error;
  return data ?? null;
}

export async function getUserLastSeen(userId: string) {
  const { data, error } = await supabase.rpc('get_user_last_seen', {
    target_user_id: userId,
  });
  if (error) throw error;
  return data ?? null;
}

export function subscribeToOwnPresence(userId: string) {
  let disposed = false;
  let subscribed = false;
  let channel: RealtimeChannel | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const sessionKey = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const stopHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const persistLastSeen = () => {
    void touchMyLastSeen().catch((error) => {
      if (!disposed) console.warn('Unable to update last seen:', error);
    });
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    persistLastSeen();
    heartbeatTimer = setInterval(persistLastSeen, LAST_SEEN_HEARTBEAT_MS);
  };

  const trackActive = async () => {
    if (disposed || !channel || !subscribed || AppState.currentState !== 'active') return;
    try {
      const response = await channel.track({
        user_id: userId,
        app_state: 'active',
        online_at: new Date().toISOString(),
      });
      if (response !== 'ok') {
        console.warn('PulseChat presence track returned:', response);
        return;
      }
      startHeartbeat();
    } catch (error) {
      if (!disposed) console.warn('Unable to publish PulseChat presence:', error);
    }
  };

  const untrackActive = async () => {
    stopHeartbeat();
    persistLastSeen();
    if (!channel || !subscribed) return;
    try {
      await channel.untrack();
    } catch (error) {
      if (!disposed) console.warn('Unable to untrack PulseChat presence:', error);
    }
  };

  const handleAppState = (state: AppStateStatus) => {
    // React Native Web marks an unfocused browser tab/window as background.
    // For PulseChat web testing, an open page should remain online even when
    // the user clicks the second side-by-side browser window. Native mobile
    // still untracks immediately when the app actually backgrounds.
    if (Platform.OS === 'web') return;

    if (state === 'active') {
      if (!supabase.realtime.isConnected()) supabase.realtime.connect();
      void trackActive();
    } else {
      void untrackActive();
    }
  };

  const appStateSubscription = Platform.OS === 'web'
    ? null
    : AppState.addEventListener('change', handleAppState);

  void (async () => {
    try {
      await supabase.realtime.setAuth();
      if (disposed) return;

      channel = supabase.channel(`presence:${userId}`, {
        config: {
          private: true,
          presence: { key: sessionKey, enabled: true },
        },
      });

      channel.subscribe((status: string, error?: Error) => {
        if (disposed) return;
        subscribed = status === 'SUBSCRIBED';

        if (status === 'SUBSCRIBED') {
          void trackActive();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('PulseChat own presence channel:', status, error ?? 'No error details');
        }
      });
    } catch (error) {
      if (!disposed) console.warn('Unable to start PulseChat presence:', error);
    }
  })();

  return () => {
    disposed = true;
    appStateSubscription?.remove();
    stopHeartbeat();
    persistLastSeen();
    if (channel) {
      void channel.untrack().finally(() => {
        if (channel) void supabase.removeChannel(channel);
      });
    }
  };
}

export function subscribeToPeerPresence(
  peerUserId: string,
  onChange: (state: PeerPresenceState) => void,
) {
  let disposed = false;
  let channel: RealtimeChannel | null = null;
  let lastOnline = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const refreshLastSeen = async (online = false) => {
    try {
      const lastSeenAt = await getUserLastSeen(peerUserId);
      if (!disposed) onChange({ online, lastSeenAt });
    } catch (error) {
      if (!disposed) console.warn('Unable to load peer last seen:', error);
    }
  };

  const syncPresence = () => {
    if (!channel || disposed) return;
    const online = hasOnlinePeer(channel, peerUserId);

    if (online) {
      lastOnline = true;
      onChange({ online: true, lastSeenAt: new Date().toISOString() });
      return;
    }

    if (lastOnline) {
      lastOnline = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refreshLastSeen(false), 250);
    } else {
      void refreshLastSeen(false);
    }
  };

  void refreshLastSeen(false);

  void (async () => {
    try {
      await supabase.realtime.setAuth();
      if (disposed) return;

      channel = supabase
        .channel(`presence:${peerUserId}`, {
          config: { private: true, presence: { enabled: true } },
        })
        .on('presence', { event: 'sync' }, syncPresence)
        .subscribe((status: string, error?: Error) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') syncPresence();
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('PulseChat peer presence channel:', status, error ?? 'No error details');
          }
        });
    } catch (error) {
      if (!disposed) console.warn('Unable to observe peer presence:', error);
    }
  })();

  return () => {
    disposed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (channel) void supabase.removeChannel(channel);
  };
}

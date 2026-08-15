import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { supabase } from '@/lib/supabase';

const LAST_SEEN_HEARTBEAT_MS = 60_000;

async function removeExistingRealtimeChannel(topic: string) {
  const realtimeTopic = `realtime:${topic}`;
  const existing = supabase.getChannels().find((candidate) => candidate.topic === realtimeTopic);
  if (!existing) return;

  try {
    await supabase.removeChannel(existing);
  } catch (error) {
    console.warn(`Unable to clean up existing Realtime channel ${topic}:`, error);
  }
}

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

      // React 19 development Strict Mode can mount, clean up, and immediately
      // remount effects. Supabase returns an already-existing channel for the
      // same topic, and Presence callbacks cannot be added after subscribe().
      // Ensure any stale same-topic channel is fully removed before registering
      // callbacks/subscribing on a fresh instance.
      await removeExistingRealtimeChannel(`presence:${userId}`);
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

type PeerPresenceListener = (state: PeerPresenceState) => void;

type PeerPresenceEntry = {
  peerUserId: string;
  channel: RealtimeChannel | null;
  listeners: Set<PeerPresenceListener>;
  state: PeerPresenceState;
  lastOnline: boolean;
  disposed: boolean;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};

const peerPresenceEntries = new Map<string, PeerPresenceEntry>();
const PEER_PRESENCE_CLEANUP_DELAY_MS = 500;

function emitPeerPresence(entry: PeerPresenceEntry, state: PeerPresenceState) {
  entry.state = state;
  entry.listeners.forEach((listener) => listener(state));
}

async function startPeerPresenceEntry(entry: PeerPresenceEntry) {
  const refreshLastSeen = async (online = false) => {
    try {
      const lastSeenAt = await getUserLastSeen(entry.peerUserId);
      if (!entry.disposed) emitPeerPresence(entry, { online, lastSeenAt });
    } catch (error) {
      if (!entry.disposed) console.warn('Unable to load peer last seen:', error);
    }
  };

  const syncPresence = () => {
    if (!entry.channel || entry.disposed) return;
    const online = hasOnlinePeer(entry.channel, entry.peerUserId);

    if (online) {
      entry.lastOnline = true;
      emitPeerPresence(entry, { online: true, lastSeenAt: new Date().toISOString() });
      return;
    }

    if (entry.lastOnline) {
      entry.lastOnline = false;
      if (entry.refreshTimer) clearTimeout(entry.refreshTimer);
      entry.refreshTimer = setTimeout(() => void refreshLastSeen(false), 250);
    } else {
      void refreshLastSeen(false);
    }
  };

  void refreshLastSeen(false);

  try {
    await supabase.realtime.setAuth();
    if (entry.disposed) return;

    // supabase-js returns the already-registered channel when the topic exists.
    // A stale HMR/dev channel would therefore reject new Presence callbacks.
    // Remove it before building the single shared observer for this peer.
    await removeExistingRealtimeChannel(`presence:${entry.peerUserId}`);
    if (entry.disposed) return;

    const channel = supabase
      .channel(`presence:${entry.peerUserId}`, {
        config: { private: true, presence: { enabled: true } },
      })
      .on('presence', { event: 'sync' }, syncPresence);

    entry.channel = channel;

    channel.subscribe((status: string, error?: Error) => {
      if (entry.disposed) return;
      if (status === 'SUBSCRIBED') syncPresence();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('PulseChat peer presence channel:', status, error ?? 'No error details');
      }
    });
  } catch (error) {
    if (!entry.disposed) console.warn('Unable to observe peer presence:', error);
  }
}

function createPeerPresenceEntry(peerUserId: string): PeerPresenceEntry {
  const entry: PeerPresenceEntry = {
    peerUserId,
    channel: null,
    listeners: new Set(),
    state: { online: false, lastSeenAt: null },
    lastOnline: false,
    disposed: false,
    refreshTimer: null,
    cleanupTimer: null,
  };

  peerPresenceEntries.set(peerUserId, entry);
  void startPeerPresenceEntry(entry);
  return entry;
}

export function subscribeToPeerPresence(
  peerUserId: string,
  onChange: (state: PeerPresenceState) => void,
) {
  let entry = peerPresenceEntries.get(peerUserId);
  if (!entry || entry.disposed) entry = createPeerPresenceEntry(peerUserId);

  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
    entry.cleanupTimer = null;
  }

  entry.listeners.add(onChange);
  onChange(entry.state);

  return () => {
    entry!.listeners.delete(onChange);
    if (entry!.listeners.size > 0 || entry!.cleanupTimer) return;

    // React 19 development Strict Mode intentionally does an immediate
    // effect cleanup/remount. Keep the shared observer alive briefly so the
    // remount reuses it instead of racing an asynchronous channel removal.
    entry!.cleanupTimer = setTimeout(() => {
      if (entry!.listeners.size > 0) {
        entry!.cleanupTimer = null;
        return;
      }

      entry!.disposed = true;
      if (entry!.refreshTimer) clearTimeout(entry!.refreshTimer);
      entry!.refreshTimer = null;
      entry!.cleanupTimer = null;
      peerPresenceEntries.delete(peerUserId);

      const channelToRemove = entry!.channel;
      entry!.channel = null;
      if (channelToRemove) void supabase.removeChannel(channelToRemove);
    }, PEER_PRESENCE_CLEANUP_DELAY_MS);
  };
}

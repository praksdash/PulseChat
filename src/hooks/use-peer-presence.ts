import { useEffect, useState } from 'react';

import { subscribeToPeerPresence, type PeerPresenceState } from '@/services/presence-service';

const EMPTY_STATE: PeerPresenceState = { online: false, lastSeenAt: null };

export function usePeerPresence(peerUserId: string | null | undefined, enabled = true) {
  const [presence, setPresence] = useState<PeerPresenceState>(EMPTY_STATE);

  useEffect(() => {
    if (!peerUserId || !enabled) {
      setPresence(EMPTY_STATE);
      return undefined;
    }

    setPresence(EMPTY_STATE);
    return subscribeToPeerPresence(peerUserId, setPresence);
  }, [enabled, peerUserId]);

  return presence;
}

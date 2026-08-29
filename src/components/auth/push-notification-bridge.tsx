import type * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { getConversationSummary } from '@/services/conversation-service';
import { getMessageDetail } from '@/services/message-service';
import { subscribeToInboxMessages } from '@/services/inbox-message-events';
import { canShowBrowserNotifications, isBrowserTabHidden, showBrowserNotification } from '@/services/browser-notification-service';
import { emitConversationActivity, subscribeToConversationActivity } from '@/services/conversation-events';
import { DEFAULT_NOTIFICATION_PREFERENCES, getMyConversationNotificationState, getMyNotificationPreferences, subscribeToNotificationPreferences } from '@/services/settings-service';
import {
  clearLastNotificationResponse,
  getActivePushConversation,
  getLastNotificationResponse,
  registerForPushNotifications,
  resumePushRegistration,
  subscribeToForegroundNotifications,
  subscribeToNativePushTokenChanges,
  subscribeToNotificationResponses,
  syncApplicationBadge,
} from '@/services/push-notification-service';

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getConversationIdFromNotification(notification: Notifications.Notification) {
  const data = notification.request.content.data as Record<string, unknown> | undefined;
  return isUuid(data?.conversationId) ? data.conversationId : null;
}

export function PushNotificationBridge() {
  const { user } = useAuth();
  const handledResponseIds = useRef(new Set<string>());
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const badgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    handledResponseIds.current.clear();
    setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    if (!user?.id) return undefined;

    let active = true;
    let initialPreferencesLoaded = false;
    const unsubscribe = subscribeToNotificationPreferences((preferences) => {
      // The settings service cache can still contain the previous account's
      // value during a same-process account switch. Ignore cached emissions
      // until this user's authoritative fetch completes.
      if (active && initialPreferencesLoaded) setNotificationPreferences(preferences);
    });

    void getMyNotificationPreferences()
      .then((preferences) => {
        if (!active) return;
        initialPreferencesLoaded = true;
        setNotificationPreferences(preferences);
      })
      .catch((error) => {
        console.warn('Unable to load notification preferences:', error);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.id]);

  const scheduleBadgeSync = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => {
      badgeTimerRef.current = null;
      void syncApplicationBadge().catch((error) => {
        console.warn('Unable to sync notification badge:', error);
      });
    }, 180);
  }, []);

  const handleNotificationResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!user?.id) return;

    const requestId = response.notification.request.identifier;
    if (handledResponseIds.current.has(requestId)) return;
    handledResponseIds.current.add(requestId);

    const conversationId = getConversationIdFromNotification(response.notification);
    if (!conversationId) return;

    // Consume the launch response once even when membership has since changed.
    // Otherwise a removed user's stale group notification would be retried on
    // every authenticated layout mount.
    await clearLastNotificationResponse().catch(() => undefined);

    try {
      // Never navigate solely because arbitrary notification data contains a
      // UUID. The server projection confirms the signed-in user is still a
      // member (important after group removal).
      const summary = await getConversationSummary(conversationId);
      if (!summary) return;

      router.push({
        pathname: '/chat/[conversationId]',
        params: {
          conversationId,
          name: summary.display_name,
        },
      });
    } catch (error) {
      console.warn('Unable to open notification conversation:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || Platform.OS !== 'web') return undefined;

    return subscribeToInboxMessages((event) => {
      if (event.senderId === user.id) return;
      if (!notificationPreferences.browser_notifications) return;
      if (!canShowBrowserNotifications() || !isBrowserTabHidden()) return;
      if (getActivePushConversation() === event.conversationId) return;

      void (async () => {
        try {
          const [summary, message, muteState] = await Promise.all([
            getConversationSummary(event.conversationId),
            getMessageDetail(event.messageId),
            getMyConversationNotificationState(event.conversationId),
          ]);
          if (!summary || !message || message.deleted_at || muteState.is_muted) return;
          if (summary.kind === 'direct' && !notificationPreferences.direct_messages) return;
          if (summary.kind === 'group' && !notificationPreferences.group_messages) return;

          let title = summary.display_name || 'PulseChat';
          let body = message.body?.trim() || 'New message';
          if (message.message_type === 'image') body = message.body?.trim() ? `📷 ${message.body.trim()}` : '📷 Photo';
          if (body.length > 180) body = `${body.slice(0, 177)}…`;
          if (!notificationPreferences.show_message_preview) {
            title = 'PulseChat';
            body = summary.kind === 'group' ? 'New group message' : 'New message';
          }

          showBrowserNotification({
            title,
            body,
            conversationId: event.conversationId,
            onClick: () => {
              router.push({
                pathname: '/chat/[conversationId]',
                params: { conversationId: event.conversationId, name: summary.display_name },
              });
            },
          });
        } catch (error) {
          console.warn('Unable to show PulseChat browser notification:', error);
        }
      })();
    });
  }, [notificationPreferences, user?.id]);

  useEffect(() => {
    if (!user?.id || Platform.OS === 'web') return undefined;

    resumePushRegistration();
    void registerForPushNotifications()
      .then((result) => {
        if (result.status === 'denied') {
          console.info('PulseChat notifications are disabled by device permission.');
        }
      })
      .catch((error) => {
        console.warn('Unable to register for push notifications:', error);
      });

    const unsubscribeTokenChanges = subscribeToNativePushTokenChanges((error) => {
      console.warn('Unable to refresh rotated push token:', error);
    });
    const unsubscribeResponses = subscribeToNotificationResponses((response) => {
      void handleNotificationResponse(response);
    });
    const unsubscribeForeground = subscribeToForegroundNotifications((notification) => {
      const conversationId = getConversationIdFromNotification(notification);
      emitConversationActivity({ type: 'message', conversationId: conversationId ?? undefined });
      scheduleBadgeSync();
    });

    void getLastNotificationResponse()
      .then((response) => {
        if (response) void handleNotificationResponse(response);
      })
      .catch((error) => console.warn('Unable to read launch notification:', error));

    scheduleBadgeSync();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void registerForPushNotifications().catch((error) => {
        console.warn('Unable to refresh push registration:', error);
      });
      scheduleBadgeSync();
    });

    const unsubscribeConversationActivity = subscribeToConversationActivity(() => {
      scheduleBadgeSync();
    });

    return () => {
      unsubscribeTokenChanges();
      unsubscribeResponses();
      unsubscribeForeground();
      unsubscribeConversationActivity();
      appStateSubscription.remove();
      if (badgeTimerRef.current) {
        clearTimeout(badgeTimerRef.current);
        badgeTimerRef.current = null;
      }
    };
  }, [handleNotificationResponse, scheduleBadgeSync, user?.id]);

  return null;
}

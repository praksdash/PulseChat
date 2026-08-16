import { Platform } from 'react-native';

export type BrowserNotificationPermission = 'unsupported' | NotificationPermission;

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.requestPermission();
}

export function canShowBrowserNotifications() {
  return getBrowserNotificationPermission() === 'granted';
}

export function isBrowserTabHidden() {
  return Platform.OS === 'web'
    && typeof document !== 'undefined'
    && document.visibilityState !== 'visible';
}

export function showBrowserNotification(input: {
  title: string;
  body: string;
  conversationId?: string | null;
  force?: boolean;
  onClick?: () => void;
}) {
  if (!canShowBrowserNotifications()) return false;
  if (!input.force && !isBrowserTabHidden()) return false;

  const notification = new window.Notification(input.title, {
    body: input.body,
    icon: '/favicon.ico',
    tag: input.conversationId ? `pulsechat:${input.conversationId}` : 'pulsechat:test',
  });

  notification.onclick = () => {
    try {
      window.focus();
      input.onClick?.();
    } finally {
      notification.close();
    }
  };

  return true;
}

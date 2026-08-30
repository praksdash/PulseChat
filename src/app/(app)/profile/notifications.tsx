import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, SettingsToggleRow, SurfaceCard } from '@/components/ui';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  type BrowserNotificationPermission,
} from '@/services/browser-notification-service';
import {
  getNativeNotificationStatus,
  registerForPushNotifications,
  sendLocalTestNotification,
  sendRemoteTestNotification,
  type NativeNotificationStatus,
} from '@/services/push-notification-service';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from '@/services/settings-service';
import { useAppTheme } from '@/theme';
import type { NotificationPreferences } from '@/types/settings';

const EMPTY_NATIVE_STATUS: NativeNotificationStatus = {
  supported: false,
  permission: 'unsupported',
  registeredDevices: 0,
  latestRegistrationAt: null,
  registrationError: null,
};

function formatDate(value: string | null) {
  if (!value) return 'Not registered yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Registered' : `Updated ${date.toLocaleString()}`;
}

export default function NotificationSettingsScreen() {
  const theme = useAppTheme();
  const [nativeStatus, setNativeStatus] = useState<NativeNotificationStatus>(EMPTY_NATIVE_STATUS);
  const [browserPermission, setBrowserPermission] = useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [savingPreference, setSavingPreference] = useState<keyof NotificationPreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBrowserPermission(getBrowserNotificationPermission());
    try {
      setPreferences(await getMyNotificationPreferences());
    } catch (preferenceError) {
      setError(preferenceError instanceof Error ? preferenceError.message : 'Unable to read notification preferences.');
    }

    if (Platform.OS === 'web') return;
    try {
      const nextStatus = await getNativeNotificationStatus();
      setNativeStatus(nextStatus);
      if (nextStatus.registrationError) {
        setError(`Unable to verify push registration: ${nextStatus.registrationError}`);
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to read notification status.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (task: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await task();
      await refresh();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Notification action failed.');
    } finally {
      setLoading(false);
    }
  };

  const savePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (savingPreference) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSavingPreference(key);
    setMessage(null);
    setError(null);

    try {
      if (key === 'browser_notifications' && value && Platform.OS === 'web') {
        const permission = await requestBrowserNotificationPermission();
        setBrowserPermission(permission);
        if (permission !== 'granted') {
          throw new Error('Browser notification permission was not granted.');
        }
      }
      setPreferences(await updateMyNotificationPreferences(next));
    } catch (preferenceError) {
      setPreferences(previous);
      setError(preferenceError instanceof Error ? preferenceError.message : 'Unable to save notification preference.');
    } finally {
      setSavingPreference(null);
    }
  };

  const enableNative = () => run(async () => {
    const result = await registerForPushNotifications();
    if (result.status === 'denied') throw new Error('Android notification permission is denied. Enable it in system settings.');
    if (result.status !== 'registered') throw new Error('This device could not register for remote notifications.');
    setMessage('This phone is registered for PulseChat push notifications.');
  });

  const testLocal = () => run(async () => {
    await sendLocalTestNotification();
    setMessage('Local notification sent. It should appear immediately on this phone.');
  });

  const testRemote = () => run(async () => {
    const result = await sendRemoteTestNotification();
    if (result.errors > 0 || result.sent < 1) {
      throw new Error(result.details?.[0] ?? 'Expo accepted no remote notification for this account.');
    }
    setMessage(`Remote push accepted for ${result.sent} registered device${result.sent === 1 ? '' : 's'}.`);
  });

  const enableBrowser = () => run(async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserPermission(permission);
    if (permission !== 'granted') throw new Error('Browser notification permission was not granted.');
    if (!preferences.browser_notifications) {
      setPreferences(await updateMyNotificationPreferences({ ...preferences, browser_notifications: true }));
    }
    setMessage('Browser alerts are enabled for PulseChat.');
  });

  const testBrowser = () => run(async () => {
    let permission = getBrowserNotificationPermission();
    if (permission !== 'granted') permission = await requestBrowserNotificationPermission();
    setBrowserPermission(permission);
    if (permission !== 'granted') throw new Error('Browser notification permission is not granted.');
    const shown = showBrowserNotification({
      title: 'PulseChat test',
      body: 'Browser notifications are working.',
      force: true,
    });
    if (!shown) throw new Error('This browser could not display the notification.');
    setMessage('Browser test notification sent.');
  });

  const nativeReady = nativeStatus.permission === 'granted' && nativeStatus.registeredDevices > 0;
  const browserReady = browserPermission === 'granted' && preferences.browser_notifications;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile/settings')} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.titleArea}>
          <AppText variant="heading">Notifications</AppText>
          <AppText variant="caption" tone="secondary">Message and device alerts</AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <AppText variant="captionStrong" tone="secondary" style={styles.sectionTitle}>MESSAGE NOTIFICATIONS</AppText>
          <SurfaceCard style={styles.preferencesCard}>
            <SettingsToggleRow
              icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
              title="Direct messages"
              subtitle="Notify me for one-to-one chats"
              value={preferences.direct_messages}
              disabled={Boolean(savingPreference)}
              onValueChange={(value) => void savePreference('direct_messages', value)}
            />
            <SettingsToggleRow
              icon={{ ios: 'person.3.fill', android: 'groups', web: 'groups' }}
              title="Group messages"
              subtitle="Notify me for group chats"
              value={preferences.group_messages}
              disabled={Boolean(savingPreference)}
              onValueChange={(value) => void savePreference('group_messages', value)}
            />
            <SettingsToggleRow
              icon={{ ios: 'text.bubble.fill', android: 'message', web: 'message' }}
              title="Message previews"
              subtitle="Show sender/message text in notifications"
              value={preferences.show_message_preview}
              disabled={Boolean(savingPreference)}
              onValueChange={(value) => void savePreference('show_message_preview', value)}
              last={Platform.OS !== 'web'}
            />
            {Platform.OS === 'web' ? (
              <SettingsToggleRow
                icon={{ ios: 'globe', android: 'language', web: 'language' }}
                title="Browser notifications"
                subtitle="Show desktop alerts while PulseChat is open"
                value={preferences.browser_notifications}
                disabled={Boolean(savingPreference)}
                onValueChange={(value) => void savePreference('browser_notifications', value)}
                last
              />
            ) : null}
          </SurfaceCard>
        </View>

        {Platform.OS !== 'web' ? (
          <>
            <SurfaceCard style={styles.card}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusDot, { backgroundColor: nativeReady ? theme.colors.success : theme.colors.warning }]} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">Android push notifications</AppText>
                  <AppText variant="caption" tone="secondary">
                    {nativeReady ? 'Ready to receive remote messages' : 'Setup or verification required'}
                  </AppText>
                </View>
              </View>
              <View style={styles.detailRows}>
                <AppText variant="caption" tone="secondary">Permission: {nativeStatus.permission}</AppText>
                <AppText variant="caption" tone="secondary">Registered devices: {nativeStatus.registeredDevices}</AppText>
                <AppText variant="micro" tone="tertiary">{formatDate(nativeStatus.latestRegistrationAt)}</AppText>
              </View>
            </SurfaceCard>

            <AppButton label={nativeReady ? 'Refresh push registration' : 'Enable notifications'} loading={loading} onPress={() => void enableNative()} />
            <AppButton label="Test notification on this phone" variant="secondary" disabled={loading} onPress={() => void testLocal()} />
            <AppButton label="Test remote push from server" variant="secondary" disabled={loading} onPress={() => void testRemote()} />
          </>
        ) : (
          <>
            <SurfaceCard style={styles.card}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusDot, { backgroundColor: browserReady ? theme.colors.success : theme.colors.warning }]} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">Web browser permission</AppText>
                  <AppText variant="caption" tone="secondary">
                    {browserPermission === 'unsupported'
                      ? 'This browser does not expose the Notification API'
                      : browserReady ? 'Enabled' : `Permission: ${browserPermission}`}
                  </AppText>
                </View>
              </View>
            </SurfaceCard>

            <AppButton label={browserReady ? 'Browser notifications enabled' : 'Enable browser notifications'} loading={loading} onPress={() => void enableBrowser()} />
            <AppButton label="Send browser test notification" variant="secondary" disabled={loading || browserPermission === 'unsupported'} onPress={() => void testBrowser()} />
          </>
        )}

        <SurfaceCard style={styles.helpCard}>
          <AppText variant="captionStrong">Per-chat mute</AppText>
          <AppText variant="caption" tone="secondary">Open any conversation and use the bell control to mute or unmute only that chat.</AppText>
        </SurfaceCard>

        {message ? (
          <SurfaceCard style={[styles.feedbackCard, { borderColor: theme.colors.success }]}> 
            <AppText accessibilityLiveRegion="polite" variant="caption" tone="success">{message}</AppText>
          </SurfaceCard>
        ) : null}
        {error ? (
          <SurfaceCard style={[styles.feedbackCard, { borderColor: theme.colors.danger }]}> 
            <AppText accessibilityLiveRegion="assertive" accessibilityRole="alert" variant="caption" tone="danger">{error}</AppText>
          </SurfaceCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  titleArea: { gap: 1 },
  content: { padding: 18, paddingBottom: 36, gap: 14 },
  section: { gap: 8 },
  sectionTitle: { paddingLeft: 4 },
  preferencesCard: { overflow: 'hidden' },
  card: { padding: 18, gap: 14 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  flex: { flex: 1, gap: 2 },
  detailRows: { gap: 4, paddingLeft: 24 },
  helpCard: { padding: 16, gap: 6 },
  feedbackCard: { padding: 14, gap: 4, borderWidth: StyleSheet.hairlineWidth },
});

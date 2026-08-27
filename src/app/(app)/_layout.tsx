import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { PushNotificationBridge } from '@/components/auth';
import { ConnectivityBanner } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { subscribeToUserInbox } from '@/services/inbox-realtime-service';
import { subscribeToOwnPresence } from '@/services/presence-service';
import { useAppTheme } from '@/theme';

export default function AppLayout() {
  const theme = useAppTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeToUserInbox(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeToOwnPresence(user.id);
  }, [user?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <PushNotificationBridge />
      <ConnectivityBanner />
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[conversationId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/appearance" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/account" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/blocked-users" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="users/[userId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="groups/new" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="groups/[conversationId]" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </View>
  );
}

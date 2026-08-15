import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { subscribeToUserInbox } from '@/services/inbox-realtime-service';
import { useAppTheme } from '@/theme';

export default function AppLayout() {
  const theme = useAppTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeToUserInbox(user.id);
  }, [user?.id]);

  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[conversationId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="users/[userId]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

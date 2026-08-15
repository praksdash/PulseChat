import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function AppLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[conversationId]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

import { Tabs } from 'expo-router';

import { AppIcon } from '@/components/ui';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingTop: 7,
          paddingBottom: 7,
        },
      }}>
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <AppIcon
              name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <AppIcon
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <AppIcon
              name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

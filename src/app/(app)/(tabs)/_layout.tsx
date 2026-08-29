import { Tabs } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppIcon } from '@/components/ui';
import { getMyTotalUnreadCount } from '@/services/conversation-service';
import { subscribeToConversationActivity } from '@/services/conversation-events';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useAppTheme();
  const [totalUnread, setTotalUnread] = useState(0);
  const unreadRequestSequenceRef = useRef(0);

  const refreshUnread = useCallback(async () => {
    const requestId = ++unreadRequestSequenceRef.current;
    try {
      const count = await getMyTotalUnreadCount();
      if (requestId === unreadRequestSequenceRef.current) setTotalUnread(count);
    } catch (error) {
      console.warn('Unable to load total unread count:', error);
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const unsubscribe = subscribeToConversationActivity(() => {
      void refreshUnread();
    });
    return () => {
      unreadRequestSequenceRef.current += 1;
      unsubscribe();
    };
  }, [refreshUnread]);

  const badge = totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined;

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
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.danger,
            color: theme.colors.onDanger,
            fontSize: 10,
            fontWeight: '700',
          },
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

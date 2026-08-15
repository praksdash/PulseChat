import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Avatar } from './avatar';
import { useAppTheme } from '@/theme';

export type ChatRowModel = {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread?: number;
  online?: boolean;
  muted?: boolean;
  sentByMe?: boolean;
};

type ChatRowProps = {
  chat: ChatRowModel;
  onPress: () => void;
};

export function ChatRow({ chat, onPress }: ChatRowProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
      ]}>
      <Avatar name={chat.name} online={chat.online} />
      <View style={[styles.body, { borderBottomColor: theme.colors.divider }]}>
        <View style={styles.topLine}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {chat.name}
          </AppText>
          <AppText variant="micro" tone={chat.unread ? 'primary' : 'tertiary'}>
            {chat.time}
          </AppText>
        </View>
        <View style={styles.bottomLine}>
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.preview}>
            {chat.sentByMe ? 'You: ' : ''}{chat.preview}
          </AppText>
          {chat.unread ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <AppText variant="micro" tone="inverse" style={styles.badgeText}>{chat.unread}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 12,
  },
  body: {
    flex: 1,
    minHeight: 76,
    justifyContent: 'center',
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1 },
  preview: { flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: '800' },
});

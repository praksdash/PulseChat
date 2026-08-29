import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { Avatar } from './avatar';
import { useAppTheme } from '@/theme';

export type MessageSearchRowModel = {
  id: string;
  conversationName: string;
  conversationAvatarUri?: string | null;
  senderLabel: string;
  snippet: string;
  createdAt: string;
  messageType: string;
};

type MessageSearchRowProps = {
  result: MessageSearchRowModel;
  query: string;
  onPress: () => void;
};

function formatResultTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
  }).format(date);
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const theme = useAppTheme();
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return <AppText variant="caption" tone="secondary" numberOfLines={2}>{text}</AppText>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index < 0) {
    return <AppText variant="caption" tone="secondary" numberOfLines={2}>{text}</AppText>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + normalizedQuery.length);
  const after = text.slice(index + normalizedQuery.length);

  return (
    <Text allowFontScaling maxFontSizeMultiplier={2} numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}> 
      {before}
      <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{match}</Text>
      {after}
    </Text>
  );
}

export function MessageSearchRow({ result, query, onPress }: MessageSearchRowProps) {
  const theme = useAppTheme();
  const mediaPrefix = result.messageType === 'image' ? 'Photo · ' : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${result.senderLabel} in ${result.conversationName}: ${mediaPrefix}${result.snippet}. ${formatResultTime(result.createdAt)}`}
      accessibilityHint="Opens this message in its conversation"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
      ]}>
      <Avatar name={result.conversationName} uri={result.conversationAvatarUri} size={46} />
      <View style={[styles.body, { borderBottomColor: theme.colors.divider }]}>
        <View style={styles.topLine}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.conversationName}>
            {result.conversationName}
          </AppText>
          <AppText variant="micro" tone="tertiary">{formatResultTime(result.createdAt)}</AppText>
        </View>
        <View style={styles.senderLine}>
          <AppIcon
            name={{ ios: 'person.fill', android: 'person', web: 'person' }}
            size={13}
            color={theme.colors.textTertiary}
          />
          <AppText variant="micro" tone="tertiary" numberOfLines={1}>{result.senderLabel}</AppText>
        </View>
        <HighlightedSnippet text={`${mediaPrefix}${result.snippet}`} query={query} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 12,
  },
  body: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
    paddingRight: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  conversationName: { flex: 1 },
  senderLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

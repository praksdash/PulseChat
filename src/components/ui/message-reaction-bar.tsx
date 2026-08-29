import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useAppTheme } from '@/theme';
import type { MessageReactionSummary, SupportedReaction } from '@/types/message';

type MessageReactionBarProps = {
  reactions?: MessageReactionSummary[];
  myReaction?: SupportedReaction | null;
  onPress?: (emoji: SupportedReaction) => void;
};

export function MessageReactionBar({ reactions = [], myReaction, onPress }: MessageReactionBarProps) {
  const theme = useAppTheme();
  if (reactions.length === 0) return null;

  return (
    <View style={styles.row}>
      {reactions.map((reaction) => {
        const selected = reaction.emoji === myReaction;
        return (
          <Pressable
            key={reaction.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${reaction.count} ${reaction.emoji} reactions`}
            accessibilityHint={selected ? 'Removes your reaction' : 'Adds this reaction'}
            accessibilityState={{ selected, disabled: !onPress }}
            disabled={!onPress}
            onPress={() => onPress?.(reaction.emoji)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                opacity: pressed ? 0.72 : 1,
              },
            ]}>
            <AppText variant="captionStrong">
              {reaction.emoji} {reaction.count}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 3,
  },
  pill: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

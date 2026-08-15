import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

type MessageBubbleProps = {
  text: string;
  time: string;
  outgoing?: boolean;
  status?: MessageStatus;
  onRetry?: () => void;
};

export function MessageBubble({ text, time, outgoing = false, status, onRetry }: MessageBubbleProps) {
  const theme = useAppTheme();

  const statusContent = () => {
    if (!outgoing || !status) return null;

    if (status === 'sending') {
      return <AppText variant="micro" tone="tertiary">Sending…</AppText>;
    }

    if (status === 'failed') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry sending message"
          disabled={!onRetry}
          hitSlop={6}
          onPress={onRetry}>
          <AppText variant="micro" tone="danger">Not sent · Tap to retry</AppText>
        </Pressable>
      );
    }

    return (
      <AppIcon
        name={
          status === 'sent'
            ? { ios: 'checkmark', android: 'check', web: 'check' }
            : { ios: 'checkmark.circle.fill', android: 'done_all', web: 'done_all' }
        }
        size={14}
        color={status === 'read' ? theme.colors.primary : theme.colors.textTertiary}
      />
    );
  };

  return (
    <View
      style={[
        styles.bubble,
        outgoing ? styles.outgoing : styles.incoming,
        {
          backgroundColor: outgoing ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
          borderColor: status === 'failed' ? theme.colors.danger : theme.colors.border,
        },
      ]}>
      <AppText style={styles.text}>{text}</AppText>
      <View style={styles.meta}>
        <AppText variant="micro" tone="tertiary">{time}</AppText>
        {statusContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 7,
    gap: 4,
  },
  incoming: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  outgoing: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  text: { lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
});

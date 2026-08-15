import { StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type MessageBubbleProps = {
  text: string;
  time: string;
  outgoing?: boolean;
  status?: 'sent' | 'delivered' | 'read';
};

export function MessageBubble({ text, time, outgoing = false, status }: MessageBubbleProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.bubble,
        outgoing ? styles.outgoing : styles.incoming,
        {
          backgroundColor: outgoing ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
          borderColor: theme.colors.border,
        },
      ]}>
      <AppText style={styles.text}>{text}</AppText>
      <View style={styles.meta}>
        <AppText variant="micro" tone="tertiary">{time}</AppText>
        {outgoing && status ? (
          <AppIcon
            name={
              status === 'sent'
                ? { ios: 'checkmark', android: 'check', web: 'check' }
                : { ios: 'checkmark.circle.fill', android: 'done_all', web: 'done_all' }
            }
            size={14}
            color={status === 'read' ? theme.colors.primary : theme.colors.textTertiary}
          />
        ) : null}
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
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
});

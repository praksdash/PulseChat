import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { MessageReactionBar } from './message-reaction-bar';
import { MessageReplyPreview } from './message-reply-preview';
import { useAppTheme } from '@/theme';
import type { MessageReactionSummary, SupportedReaction } from '@/types/message';

type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

type MessageBubbleProps = {
  text: string;
  time: string;
  outgoing?: boolean;
  status?: MessageStatus;
  edited?: boolean;
  replySenderLabel?: string | null;
  replyText?: string | null;
  reactions?: MessageReactionSummary[];
  myReaction?: SupportedReaction | null;
  onReactionPress?: (emoji: SupportedReaction) => void;
  onRetry?: () => void;
  onLongPress?: () => void;
};

function MessageBubbleComponent({
  text,
  time,
  outgoing = false,
  status,
  edited = false,
  replySenderLabel,
  replyText,
  reactions,
  myReaction,
  onReactionPress,
  onRetry,
  onLongPress,
}: MessageBubbleProps) {
  const theme = useAppTheme();

  const statusContent = () => {
    if (!outgoing || !status) return null;
    if (status === 'queued') return <AppText variant="micro" tone="tertiary">Waiting for connection…</AppText>;
    if (status === 'sending') return <AppText variant="micro" tone="tertiary">Sending…</AppText>;
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
    <View style={[styles.wrapper, outgoing ? styles.outgoing : styles.incoming]}>
      <Pressable
        delayLongPress={350}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.bubble,
          {
            backgroundColor: outgoing ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
            borderColor: status === 'failed' ? theme.colors.danger : theme.colors.border,
            opacity: pressed && onLongPress ? 0.86 : 1,
          },
          outgoing ? styles.outgoingBubble : styles.incomingBubble,
        ]}>
        {replySenderLabel && replyText ? (
          <MessageReplyPreview senderLabel={replySenderLabel} text={replyText} />
        ) : null}
        <AppText style={styles.text}>{text}</AppText>
        <View style={styles.meta}>
          {edited ? <AppText variant="micro" tone="tertiary">edited</AppText> : null}
          <AppText variant="micro" tone="tertiary">{time}</AppText>
          {statusContent()}
        </View>
      </Pressable>
      <MessageReactionBar
        reactions={reactions}
        myReaction={myReaction}
        onPress={onReactionPress}
      />
    </View>
  );
}

function sameReactions(a?: MessageReactionSummary[], b?: MessageReactionSummary[]) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, index) => item.emoji === b[index]?.emoji && item.count === b[index]?.count);
}

function areMessageBubblePropsEqual(previous: MessageBubbleProps, next: MessageBubbleProps) {
  return previous.text === next.text
    && previous.time === next.time
    && previous.outgoing === next.outgoing
    && previous.status === next.status
    && previous.edited === next.edited
    && previous.replySenderLabel === next.replySenderLabel
    && previous.replyText === next.replyText
    && previous.myReaction === next.myReaction
    && previous.onReactionPress === next.onReactionPress
    && previous.onRetry === next.onRetry
    && previous.onLongPress === next.onLongPress
    && sameReactions(previous.reactions, next.reactions);
}

export const MessageBubble = memo(MessageBubbleComponent, areMessageBubblePropsEqual);

const styles = StyleSheet.create({
  wrapper: { maxWidth: '82%', gap: 2 },
  incoming: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  outgoing: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    maxWidth: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 7,
    gap: 5,
  },
  incomingBubble: { borderBottomLeftRadius: 6 },
  outgoingBubble: { borderBottomRightRadius: 6 },
  text: { lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
});

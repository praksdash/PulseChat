import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { MessageReactionBar } from './message-reaction-bar';
import { MessageReplyPreview } from './message-reply-preview';
import { useAppTheme } from '@/theme';
import type {
  MediaSendStage,
  MessageLocalState,
  MessageReactionSummary,
  SupportedReaction,
} from '@/types/message';

type MediaMessageBubbleProps = {
  uri?: string | null;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  time: string;
  outgoing?: boolean;
  status?: MessageLocalState;
  mediaStage?: MediaSendStage;
  edited?: boolean;
  replySenderLabel?: string | null;
  replyText?: string | null;
  reactions?: MessageReactionSummary[];
  myReaction?: SupportedReaction | null;
  onReactionPress?: (emoji: SupportedReaction) => void;
  onOpen?: () => void;
  onRetry?: () => void;
  onLongPress?: () => void;
};

function getPreviewSize(width?: number | null, height?: number | null) {
  const ratio = width && height ? width / height : 4 / 3;
  const clampedRatio = Math.min(1.6, Math.max(0.68, ratio));
  const previewWidth = 250;
  return { width: previewWidth, height: Math.round(previewWidth / clampedRatio) };
}

function MediaMessageBubbleComponent({
  uri,
  width,
  height,
  caption,
  time,
  outgoing = false,
  status,
  mediaStage,
  edited = false,
  replySenderLabel,
  replyText,
  reactions,
  myReaction,
  onReactionPress,
  onOpen,
  onRetry,
  onLongPress,
}: MediaMessageBubbleProps) {
  const theme = useAppTheme();
  const preview = getPreviewSize(width, height);
  const messageLabel = `${outgoing ? 'You sent' : 'Received'} a photo${caption ? `: ${caption}` : ''}. ${time}${edited ? '. Edited' : ''}${status ? `. ${status}` : ''}`;

  const stageLabel = mediaStage === 'preparing'
    ? 'Preparing photo…'
    : mediaStage === 'uploading'
      ? 'Uploading photo…'
      : mediaStage === 'committing'
        ? 'Sending photo…'
        : null;

  const statusContent = () => {
    if (!outgoing || !status) return null;
    if (status === 'queued') return <AppText variant="micro" tone="tertiary">Waiting for connection…</AppText>;
    if (status === 'sending') return <AppText variant="micro" tone="tertiary">Sending…</AppText>;
    if (status === 'failed') {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry sending photo"
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
          outgoing ? styles.outgoingBubble : styles.incomingBubble,
          {
            backgroundColor: outgoing ? theme.colors.outgoingBubble : theme.colors.incomingBubble,
            borderColor: status === 'failed' ? theme.colors.danger : theme.colors.border,
            opacity: pressed && onLongPress ? 0.86 : 1,
          },
        ]}>
        {replySenderLabel && replyText ? (
          <MessageReplyPreview senderLabel={replySenderLabel} text={replyText} />
        ) : null}

        <Pressable
          accessibilityRole={uri ? 'button' : undefined}
          accessibilityLabel={uri ? messageLabel : 'Photo preview unavailable'}
          accessibilityHint={uri ? 'Double tap to open photo. Long press for message actions.' : undefined}
          disabled={!uri || !onOpen}
          onPress={onOpen}
          onLongPress={onLongPress}
          style={[styles.imageShell, preview, { backgroundColor: theme.colors.surfaceMuted }]}> 
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
              cachePolicy="memory-disk"
              recyclingKey={uri}
            />
          ) : (
            <View style={styles.placeholder}>
              <AppIcon name={{ ios: 'photo', android: 'image', web: 'image' }} size={34} color={theme.colors.textTertiary} />
              <AppText variant="caption" tone="tertiary">Photo</AppText>
            </View>
          )}

          {stageLabel ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="progressbar"
              accessibilityLabel={stageLabel}
              style={styles.progressOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <AppText variant="micro" style={styles.progressText}>{stageLabel}</AppText>
            </View>
          ) : null}
        </Pressable>

        {caption ? <AppText style={styles.caption}>{caption}</AppText> : null}

        <View style={styles.meta}>
          {edited ? <AppText variant="micro" tone="tertiary">edited</AppText> : null}
          <AppText variant="micro" tone="tertiary">{time}</AppText>
          {statusContent()}
        </View>
      </Pressable>
      <MessageReactionBar reactions={reactions} myReaction={myReaction} onPress={onReactionPress} />
    </View>
  );
}

function sameReactions(a?: MessageReactionSummary[], b?: MessageReactionSummary[]) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((item, index) => item.emoji === b[index]?.emoji && item.count === b[index]?.count);
}

function areMediaMessageBubblePropsEqual(previous: MediaMessageBubbleProps, next: MediaMessageBubbleProps) {
  return previous.uri === next.uri
    && previous.width === next.width
    && previous.height === next.height
    && previous.caption === next.caption
    && previous.time === next.time
    && previous.outgoing === next.outgoing
    && previous.status === next.status
    && previous.mediaStage === next.mediaStage
    && previous.edited === next.edited
    && previous.replySenderLabel === next.replySenderLabel
    && previous.replyText === next.replyText
    && previous.myReaction === next.myReaction
    && previous.onReactionPress === next.onReactionPress
    && previous.onOpen === next.onOpen
    && previous.onRetry === next.onRetry
    && previous.onLongPress === next.onLongPress
    && sameReactions(previous.reactions, next.reactions);
}

export const MediaMessageBubble = memo(MediaMessageBubbleComponent, areMediaMessageBubblePropsEqual);

const styles = StyleSheet.create({
  wrapper: { maxWidth: '86%', gap: 2 },
  incoming: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  outgoing: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: {
    maxWidth: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 5,
  },
  incomingBubble: { borderBottomLeftRadius: 6 },
  outgoingBubble: { borderBottomRightRadius: 6 },
  imageShell: { overflow: 'hidden', borderRadius: 14 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  progressOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(9, 18, 28, 0.52)',
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  progressText: { color: '#FFFFFF' },
  caption: { paddingHorizontal: 8, paddingTop: 2, lineHeight: 20 },
  meta: {
    minHeight: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    paddingHorizontal: 7, paddingBottom: 2,
  },
});

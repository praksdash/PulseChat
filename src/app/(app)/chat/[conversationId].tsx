import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, Avatar, EmptyState } from '@/components/ui';
import { getConversationSummary } from '@/services/conversation-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { useAppTheme } from '@/theme';
import type { ConversationSummary } from '@/types/conversation';

export default function ConversationScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    name?: string | string[];
  }>();
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const fallbackName = Array.isArray(params.name) ? params.name[0] : params.name;

  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!conversationId) {
      setError('This conversation link is invalid.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getConversationSummary(conversationId);
      setSummary(data);
      if (!data) setError('This conversation is unavailable or you are no longer a member.');
    } catch (loadError) {
      console.warn('Unable to load conversation:', loadError);
      setError('Unable to load this conversation right now.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const name = summary?.display_name ?? fallbackName ?? 'Conversation';
  const avatarUri = getAvatarPublicUrl(summary?.avatar_path);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to chats"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.roundButton}>
          <AppIcon
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={24}
            color={theme.colors.primary}
          />
        </Pressable>
        <Avatar name={name} uri={avatarUri} size={38} />
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          <AppText variant="micro" tone="secondary">
            {summary?.username ? `@${summary.username}` : summary?.kind === 'group' ? 'group' : 'direct chat'}
          </AppText>
        </View>
        <Pressable accessibilityLabel="Conversation options" hitSlop={10} style={styles.roundButton}>
          <AppIcon
            name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Opening conversation…</AppText>
        </View>
      ) : error || !summary ? (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'exclamationmark.bubble', android: 'chat_error', web: 'chat_error' }}
            title="Conversation unavailable"
            description={error ?? 'This conversation is unavailable.'}
          />
          <View style={styles.actionWidth}>
            <AppButton label="Try again" variant="secondary" onPress={() => void loadSummary()} />
          </View>
        </View>
      ) : (
        <View style={styles.messages}>
          <EmptyState
            icon={{ ios: 'message', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
            title={`Chat with ${summary.display_name}`}
            description="This direct conversation now exists securely in Supabase. Realtime text messages arrive in Phase 9."
          />
          <View style={[styles.phaseBadge, { backgroundColor: theme.colors.primarySoft }]}>
            <AppText variant="captionStrong" tone="primary">PHASE 8 • CONVERSATION READY</AppText>
          </View>
        </View>
      )}

      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Pressable disabled style={[styles.iconButton, { backgroundColor: theme.colors.surfaceMuted, opacity: 0.6 }]}>
          <AppIcon
            name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }}
            size={22}
            color={theme.colors.textTertiary}
          />
        </Pressable>
        <View style={[styles.inputShell, { backgroundColor: theme.colors.surfaceMuted }]}>
          <TextInput
            editable={false}
            placeholder="Messaging arrives in Phase 9"
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.input, theme.typography.body, { color: theme.colors.text }]}
          />
        </View>
        <View style={[styles.sendButton, { backgroundColor: theme.colors.primary, opacity: 0.45 }]}>
          <AppIcon
            name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
            size={21}
            color="#FFFFFF"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 9,
  },
  roundButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, gap: 18 },
  actionWidth: { width: '100%', maxWidth: 260 },
  messages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  phaseBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  inputShell: { flex: 1, minHeight: 44, borderRadius: 22, justifyContent: 'center', paddingHorizontal: 14 },
  input: { minHeight: 42, paddingVertical: 0 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

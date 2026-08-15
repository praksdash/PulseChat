import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText, Avatar, MessageBubble } from '@/components/ui';
import { useAppTheme } from '@/theme';

export default function ConversationScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ conversationId: string; name?: string }>();
  const name = typeof params.name === 'string' ? params.name : 'Conversation';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable accessibilityLabel="Back to chats" hitSlop={10} onPress={() => router.back()} style={styles.roundButton}>
          <AppIcon
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={24}
            color={theme.colors.primary}
          />
        </Pressable>
        <Avatar name={name} size={38} online />
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          <AppText variant="micro" tone="success">online</AppText>
        </View>
        <Pressable accessibilityLabel="Conversation options" hitSlop={10} style={styles.roundButton}>
          <AppIcon
            name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.messages}>
        <View style={[styles.datePill, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppText variant="micro" tone="secondary">TODAY</AppText>
        </View>
        <MessageBubble text="The Phase 3 design system is now in place." time="12:26" />
        <MessageBubble text="Nice — the chat UI already feels like a real messenger." time="12:28" outgoing status="read" />
        <MessageBubble text="Realtime messages will replace these demo bubbles in Phase 9." time="12:30" />
      </View>

      <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Pressable style={[styles.iconButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon
            name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }}
            size={22}
            color={theme.colors.textSecondary}
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
        <View style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}>
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
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 9 },
  roundButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  messages: { flex: 1, padding: 14, justifyContent: 'flex-end', gap: 8 },
  datePill: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  inputShell: { flex: 1, minHeight: 44, borderRadius: 22, justifyContent: 'center', paddingHorizontal: 14 },
  input: { minHeight: 42, paddingVertical: 0 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

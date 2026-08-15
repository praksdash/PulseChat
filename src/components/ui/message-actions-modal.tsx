import type { SymbolViewProps } from 'expo-symbols';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';
import { SUPPORTED_REACTIONS, type SupportedReaction } from '@/types/message';

type MessageActionsModalProps = {
  visible: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReaction: (emoji: SupportedReaction) => void;
};

export function MessageActionsModal({
  visible,
  canEdit,
  canDelete,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReaction,
}: MessageActionsModalProps) {
  const theme = useAppTheme();

  const action = (
    label: string,
    icon: SymbolViewProps['name'],
    onPress: () => void,
    danger = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent' },
      ]}>
      <AppIcon name={icon} size={20} color={danger ? theme.colors.danger : theme.colors.textSecondary} />
      <AppText variant="bodyStrong" style={danger ? { color: theme.colors.danger } : undefined}>{label}</AppText>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}> 
          <View style={styles.reactions}>
            {SUPPORTED_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                onPress={() => onReaction(emoji)}
                style={({ pressed }) => [
                  styles.reaction,
                  { backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surfaceMuted },
                ]}>
                <AppText style={styles.emoji}>{emoji}</AppText>
              </Pressable>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
          {action('Reply', { ios: 'arrowshape.turn.up.left', android: 'reply', web: 'reply' }, onReply)}
          {canEdit ? action('Edit', { ios: 'pencil', android: 'edit', web: 'edit' }, onEdit) : null}
          {canDelete ? action('Delete for everyone', { ios: 'trash', android: 'delete', web: 'delete' }, onDelete, true) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  sheet: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  reaction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24, lineHeight: 30 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 5 },
  action: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
});

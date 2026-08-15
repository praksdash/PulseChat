import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from './app-button';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type ConfirmActionModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmActionModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  const theme = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close confirmation"
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        onPress={loading ? undefined : onCancel}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.card, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
          <View style={styles.copy}>
            <AppText variant="heading">{title}</AppText>
            <AppText variant="body" tone="secondary">{message}</AppText>
          </View>

          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <AppButton
                label={cancelLabel}
                variant="secondary"
                disabled={loading}
                onPress={onCancel}
              />
            </View>
            <View style={styles.actionCell}>
              <AppButton
                label={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                loading={loading}
                onPress={onConfirm}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 18,
  },
  copy: { gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  actionCell: { flex: 1 },
});

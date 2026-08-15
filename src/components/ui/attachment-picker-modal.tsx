import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type AttachmentPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onChoosePhoto: () => void;
  onTakePhoto: () => void;
};

export function AttachmentPickerModal({
  visible,
  onClose,
  onChoosePhoto,
  onTakePhoto,
}: AttachmentPickerModalProps) {
  const theme = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close attachment menu"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
          onPress={onClose}
        />
        <View style={[styles.sheet, { backgroundColor: theme.colors.surfaceRaised }]}> 
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>
          <AppText variant="subheading">Send a photo</AppText>
          <AppText variant="caption" tone="secondary">
            Photos are compressed before upload and stored in your private conversation.
          </AppText>

          <Pressable
            accessibilityRole="button"
            onPress={onChoosePhoto}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
            ]}>
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}> 
              <AppIcon
                name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
                size={23}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.actionCopy}>
              <AppText variant="bodyStrong">Choose from photos</AppText>
              <AppText variant="caption" tone="secondary">Pick an image already on this device</AppText>
            </View>
          </Pressable>

          {Platform.OS !== 'web' ? (
            <Pressable
              accessibilityRole="button"
              onPress={onTakePhoto}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
              ]}>
              <View style={[styles.actionIcon, { backgroundColor: theme.colors.primarySoft }]}> 
                <AppIcon
                  name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                  size={23}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.actionCopy}>
                <AppText variant="bodyStrong">Take photo</AppText>
                <AppText variant="caption" tone="secondary">Open the camera and send a new photo</AppText>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.cancel, { borderColor: theme.colors.border }]}>
            <AppText variant="bodyStrong" tone="secondary">Cancel</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 22,
    gap: 12,
  },
  handleRow: { alignItems: 'center', paddingBottom: 2 },
  handle: { width: 42, height: 4, borderRadius: 2 },
  action: {
    minHeight: 70,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, gap: 2 },
  cancel: {
    height: 48,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});

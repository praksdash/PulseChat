import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';

type MediaViewerProps = {
  visible: boolean;
  uri?: string | null;
  caption?: string | null;
  onClose: () => void;
};

export function MediaViewer({ visible, uri, caption, onClose }: MediaViewerProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            hitSlop={12}
            onPress={onClose}
            style={styles.closeButton}>
            <AppIcon
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={26}
              color="#FFFFFF"
            />
          </Pressable>
          <AppText variant="bodyStrong" style={styles.headerTitle}>Photo</AppText>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.imageArea}>
          {uri ? (
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}
        </View>

        {caption ? (
          <View style={styles.captionArea}>
            <AppText style={styles.caption}>{caption}</AppText>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05080B' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFFFFF' },
  headerSpacer: { width: 42 },
  imageArea: { flex: 1 },
  captionArea: { paddingHorizontal: 18, paddingVertical: 14 },
  caption: { color: '#FFFFFF', textAlign: 'center' },
});

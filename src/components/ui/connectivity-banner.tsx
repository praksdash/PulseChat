import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useAppTheme } from '@/theme';

export function ConnectivityBanner() {
  const theme = useAppTheme();
  const { state, checkNow } = useConnectivity();

  if (state !== 'offline') return null;

  return (
    <View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[styles.container, { backgroundColor: theme.colors.warning }]}>
      <AppIcon
        name={{ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }}
        size={16}
        color={theme.colors.onWarning}
      />
      <View style={styles.copy}>
        <AppText variant="captionStrong" style={{ color: theme.colors.onWarning }}>Offline</AppText>
        <AppText variant="micro" style={{ color: theme.colors.onWarning }}>Saved chats remain available. Text messages queue until connection returns.</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check connection again"
        hitSlop={8}
        onPress={() => void checkNow()}>
        <AppText variant="captionStrong" style={{ color: theme.colors.onWarning }}>Retry</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  copy: { flex: 1, gap: 1 },
});

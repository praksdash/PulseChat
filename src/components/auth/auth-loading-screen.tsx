import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

export function AuthLoadingScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}> 
          <AppIcon
            name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
            size={32}
            color={theme.colors.onPrimary}
          />
        </View>
        <AppText variant="heading">PulseChat</AppText>
        <ActivityIndicator
          accessibilityLabel="Restoring your secure session"
          accessibilityRole="progressbar"
          size="small"
          color={theme.colors.primary}
        />
        <AppText variant="caption" tone="secondary">Restoring your secure session…</AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 66, height: 66, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});

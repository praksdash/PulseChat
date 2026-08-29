import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText, SettingsRow, SurfaceCard } from '@/components/ui';
import { useAppTheme } from '@/theme';

function preferenceLabel(preference: 'system' | 'light' | 'dark') {
  if (preference === 'system') return 'Use device appearance';
  return preference === 'dark' ? 'Dark' : 'Light';
}

export default function SettingsScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} color={theme.colors.text} />
        </Pressable>
        <View>
          <AppText variant="heading">Settings</AppText>
          <AppText variant="caption" tone="secondary">Customize PulseChat</AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceCard style={styles.card}>
          <SettingsRow
            icon={{ ios: 'paintpalette.fill', android: 'palette', web: 'palette' }}
            title="Appearance"
            subtitle={preferenceLabel(theme.preference)}
            onPress={() => router.push('/profile/appearance')}
          />
          <SettingsRow
            icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
            title="Notifications"
            subtitle="Messages, previews and device alerts"
            onPress={() => router.push('/profile/notifications')}
          />
          <SettingsRow
            icon={{ ios: 'shield.fill', android: 'shield', web: 'shield' }}
            title="Privacy & security"
            subtitle="Discovery, activity, messages and blocks"
            onPress={() => router.push('/profile/privacy')}
          />
          <SettingsRow
            icon={{ ios: 'person.crop.circle', android: 'manage_accounts', web: 'manage_accounts' }}
            title="Account"
            subtitle="Email, sign out and delete account"
            onPress={() => router.push('/profile/account')}
            last
          />
        </SurfaceCard>

        <SurfaceCard style={styles.aboutCard}>
          <AppText variant="captionStrong">PulseChat</AppText>
          <AppText variant="caption" tone="secondary">Prototype V1 · Phase 23 UX and accessibility polish</AppText>
        </SurfaceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  card: { overflow: 'hidden' },
  aboutCard: { padding: 16, gap: 4 },
});

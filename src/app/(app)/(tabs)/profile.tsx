import { Href, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, Avatar, SettingsRow, SurfaceCard } from '@/components/ui';
import { useAppTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="title">Profile</AppText>
          <AppText variant="caption" tone="secondary">Design preview</AppText>
        </View>

        <SurfaceCard style={styles.profileCard}>
          <Avatar name="PulseChat User" size={88} online />
          <View style={styles.identity}>
            <AppText variant="heading">PulseChat User</AppText>
            <AppText tone="secondary">@prototype</AppText>
            <AppText variant="caption" tone="secondary" style={styles.bio}>
              Building a private, fast and simple messaging experience.
            </AppText>
          </View>
        </SurfaceCard>

        <View style={styles.section}>
          <AppText variant="captionStrong" tone="secondary" style={styles.sectionTitle}>SETTINGS PREVIEW</AppText>
          <SurfaceCard style={styles.settingsCard}>
            <SettingsRow
              icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
              title="Account"
              subtitle="Profile and username"
            />
            <SettingsRow
              icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              title="Notifications"
              subtitle="Push preferences"
            />
            <SettingsRow
              icon={{ ios: 'paintpalette.fill', android: 'palette', web: 'palette' }}
              title="Appearance"
              subtitle={theme.isDark ? 'System dark theme active' : 'System light theme active'}
            />
            <SettingsRow
              icon={{ ios: 'shield.fill', android: 'shield', web: 'shield' }}
              title="Privacy & security"
              subtitle="Blocking and account safety"
              last
            />
          </SurfaceCard>
        </View>

        <AppButton
          label="Return to login preview"
          variant="secondary"
          icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
          onPress={() => router.replace('/login' as Href)}
        />
        <AppText variant="micro" tone="tertiary" style={styles.note}>
          These rows are visual only. Their features are implemented in later phases.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 18, paddingBottom: 30, gap: 20 },
  header: { gap: 2 },
  profileCard: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  identity: { flex: 1, gap: 2 },
  bio: { marginTop: 6 },
  section: { gap: 8 },
  sectionTitle: { paddingLeft: 4 },
  settingsCard: { overflow: 'hidden' },
  note: { textAlign: 'center', paddingHorizontal: 18 },
});

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, Avatar, SettingsRow, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useAppTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { user, profile, isProfileLoading, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'PulseChat User';

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setSignOutError(null);
    setIsSigningOut(true);

    try {
      const error = await signOut();

      if (error) {
        setSignOutError(error);
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      setSignOutError('Unable to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="title">Profile</AppText>
          <AppText variant="caption" tone="secondary">Authenticated account</AppText>
        </View>

        <SurfaceCard style={styles.profileCard}>
          <Avatar name={displayName} size={88} online />
          <View style={styles.identity}>
            <AppText variant="heading">{displayName}</AppText>
            <AppText tone="secondary">{user?.email ?? 'No email available'}</AppText>
            <AppText variant="caption" tone="secondary" style={styles.bio}>
              {isProfileLoading
                ? 'Loading profile…'
                : profile?.username
                  ? `@${profile.username}`
                  : 'Username and avatar setup arrive in Phase 5.'}
            </AppText>
          </View>
        </SurfaceCard>

        <View style={styles.section}>
          <AppText variant="captionStrong" tone="secondary" style={styles.sectionTitle}>ACCOUNT</AppText>
          <SurfaceCard style={styles.settingsCard}>
            <SettingsRow
              icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
              title="Account"
              subtitle="Profile editing arrives in Phase 5"
            />
            <SettingsRow
              icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              title="Notifications"
              subtitle="Push preferences arrive in Phase 15"
            />
            <SettingsRow
              icon={{ ios: 'paintpalette.fill', android: 'palette', web: 'palette' }}
              title="Appearance"
              subtitle={theme.isDark ? 'System dark theme active' : 'System light theme active'}
            />
            <SettingsRow
              icon={{ ios: 'shield.fill', android: 'shield', web: 'shield' }}
              title="Privacy & security"
              subtitle="RLS-backed account access enabled"
              last
            />
          </SurfaceCard>
        </View>

        {signOutError ? <AppText variant="caption" tone="danger" style={styles.error}>{signOutError}</AppText> : null}

        <AppButton
          label="Sign out"
          variant="secondary"
          loading={isSigningOut}
          icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
          onPress={() => void handleSignOut()}
        />
        <AppText variant="micro" tone="tertiary" style={styles.note}>
          Your Supabase session persists across app restarts until you sign out or the session becomes invalid.
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
  error: { textAlign: 'center' },
  note: { textAlign: 'center', paddingHorizontal: 18 },
});

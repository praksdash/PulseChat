import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, Avatar, SettingsRow, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { useAppTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { user, profile, isProfileLoading, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'PulseChat User';
  const avatarUrl = useMemo(() => getAvatarPublicUrl(profile?.avatar_path), [profile?.avatar_path]);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setSignOutError(null);
    setIsSigningOut(true);

    try {
      const error = await signOut();
      if (error) setSignOutError(error);
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
          <AppText variant="caption" tone="secondary">Your PulseChat identity</AppText>
        </View>

        <SurfaceCard style={styles.profileCard}>
          <Avatar name={displayName} uri={avatarUrl} size={88} online />
          <View style={styles.identity}>
            <AppText variant="heading">{displayName}</AppText>
            {profile?.username ? (
              <AppText tone="secondary">@{profile.username}</AppText>
            ) : (
              <AppText tone="secondary">Add a username so people can find you later</AppText>
            )}
            {profile?.bio ? (
              <AppText variant="caption" tone="secondary" style={styles.bio}>{profile.bio}</AppText>
            ) : null}
            {isProfileLoading ? <AppText variant="micro" tone="tertiary">Refreshing profile…</AppText> : null}
          </View>
        </SurfaceCard>

        <AppButton
          label="Edit profile"
          variant="secondary"
          icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
          onPress={() => router.push('/profile/edit')}
        />

        <View style={styles.section}>
          <AppText variant="captionStrong" tone="secondary" style={styles.sectionTitle}>SETTINGS</AppText>
          <SurfaceCard style={styles.settingsCard}>
            <SettingsRow
              icon={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              title="Settings"
              subtitle="Appearance, notifications, privacy and account"
              onPress={() => router.push('/profile/settings')}
              last
            />
          </SurfaceCard>
        </View>

        {signOutError ? <AppText accessibilityLiveRegion="assertive" accessibilityRole="alert" variant="caption" tone="danger" style={styles.error}>{signOutError}</AppText> : null}

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
  identity: { flex: 1, gap: 3 },
  bio: { marginTop: 6 },
  section: { gap: 8 },
  sectionTitle: { paddingLeft: 4 },
  settingsCard: { overflow: 'hidden' },
  error: { textAlign: 'center' },
  note: { textAlign: 'center', paddingHorizontal: 18 },
});

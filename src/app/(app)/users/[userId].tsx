import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, Avatar, EmptyState, SurfaceCard } from '@/components/ui';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { getPublicUserProfile } from '@/services/user-discovery-service';
import { useAppTheme } from '@/theme';
import type { PublicUserProfile } from '@/types/user-discovery';

export default function PublicUserProfileScreen() {
  const theme = useAppTheme();
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  const resolvedUserId = Array.isArray(userId) ? userId[0] : userId;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!resolvedUserId) {
      setError('This profile link is invalid.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getPublicUserProfile(resolvedUserId);
      setProfile(data);
      if (!data) setError('This PulseChat profile could not be found.');
    } catch (loadError) {
      console.warn('Unable to load public profile:', loadError);
      setError('Unable to load this profile right now.');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUserId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={23}
            color={theme.colors.primary}
          />
        </Pressable>
        <AppText variant="subheading" style={styles.headerTitle}>Profile</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Loading profile…</AppText>
        </View>
      ) : error || !profile ? (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'person.crop.circle.badge.exclamationmark', android: 'person_off', web: 'person_off' }}
            title="Profile unavailable"
            description={error ?? 'This profile is unavailable.'}
          />
          <View style={styles.actionWidth}>
            <AppButton label="Try again" variant="secondary" onPress={() => void loadProfile()} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            <Avatar
              name={profile.display_name}
              uri={getAvatarPublicUrl(profile.avatar_path)}
              size={100}
            />
            <View style={styles.identityCopy}>
              <AppText variant="heading" style={styles.centerText}>{profile.display_name}</AppText>
              <AppText variant="body" tone={profile.username ? 'primary' : 'tertiary'} style={styles.centerText}>
                {profile.username ? `@${profile.username}` : 'No username yet'}
              </AppText>
            </View>
          </View>

          {profile.bio ? (
            <SurfaceCard style={styles.card}>
              <AppText variant="captionStrong" tone="secondary">ABOUT</AppText>
              <AppText variant="body">{profile.bio}</AppText>
            </SurfaceCard>
          ) : null}

          <SurfaceCard style={styles.card}>
            <View style={styles.privacyRow}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
                <AppIcon
                  name={{ ios: 'lock.shield', android: 'shield_lock', web: 'shield_lock' }}
                  size={21}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.privacyCopy}>
                <AppText variant="bodyStrong">Privacy by default</AppText>
                <AppText variant="caption" tone="secondary">
                  PulseChat discovery exposes only public profile fields. Email addresses and authentication metadata stay private.
                </AppText>
              </View>
            </View>
          </SurfaceCard>

          <View style={styles.actionArea}>
            <AppButton
              label="Start chat"
              icon={{ ios: 'message.fill', android: 'chat', web: 'chat' }}
              disabled
            />
            <AppText variant="caption" tone="tertiary" style={styles.centerText}>
              Direct-chat creation is intentionally enabled in Phase 8.
            </AppText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 44 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 60, gap: 18 },
  actionWidth: { width: '100%', maxWidth: 260 },
  content: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 46, gap: 18 },
  identity: { alignItems: 'center', gap: 14, paddingBottom: 6 },
  identityCopy: { alignItems: 'center', gap: 3 },
  centerText: { textAlign: 'center' },
  card: { padding: 18, gap: 8 },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  privacyCopy: { flex: 1, gap: 3 },
  actionArea: { paddingTop: 4, gap: 9 },
});

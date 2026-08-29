import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  AppIcon,
  AppText,
  Avatar,
  ConfirmActionModal,
  EmptyState,
  ReportModal,
  SurfaceCard,
} from '@/components/ui';
import { createOrGetDirectConversation } from '@/services/conversation-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import {
  blockUser,
  getUserRelationshipState,
  reportUserOrMessage,
  unblockUser,
} from '@/services/privacy-service';
import { getPublicUserProfile } from '@/services/user-discovery-service';
import { useAppTheme } from '@/theme';
import type { ReportReason, UserRelationshipState } from '@/types/privacy';
import type { PublicUserProfile } from '@/types/user-discovery';

export default function PublicUserProfileScreen() {
  const theme = useAppTheme();
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  const resolvedUserId = Array.isArray(userId) ? userId[0] : userId;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [relationship, setRelationship] = useState<UserRelationshipState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isChangingBlock, setIsChangingBlock] = useState(false);
  const [confirmBlockVisible, setConfirmBlockVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      if (!data) {
        setRelationship(null);
        setError('This PulseChat profile is private or could not be found.');
        return;
      }
      try {
        setRelationship(await getUserRelationshipState(resolvedUserId));
      } catch (relationshipError) {
        console.warn('Unable to load relationship state:', relationshipError);
        setRelationship(null);
      }
    } catch (loadError) {
      console.warn('Unable to load public profile:', loadError);
      setError('Unable to load this profile right now.');
    } finally {
      setIsLoading(false);
    }
  }, [resolvedUserId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const refreshRelationship = async () => {
    if (!resolvedUserId) return;
    setRelationship(await getUserRelationshipState(resolvedUserId));
  };

  const startChat = async () => {
    if (!profile || isStartingChat || relationship?.can_start_direct === false) return;
    setIsStartingChat(true);
    setActionError(null);
    try {
      const conversationId = await createOrGetDirectConversation(profile.id);
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId, name: profile.display_name } });
    } catch (chatError) {
      setActionError(chatError instanceof Error ? chatError.message : 'Unable to start this conversation right now.');
      try { await refreshRelationship(); } catch { /* server error already shown */ }
    } finally {
      setIsStartingChat(false);
    }
  };

  const changeBlock = async () => {
    if (!profile || isChangingBlock) return;
    setIsChangingBlock(true);
    setActionError(null);
    try {
      if (relationship?.blocked_by_me) await unblockUser(profile.id);
      else await blockUser(profile.id);
      setConfirmBlockVisible(false);
      await refreshRelationship();
    } catch (blockError) {
      setActionError(blockError instanceof Error ? blockError.message : 'Unable to update this block.');
    } finally {
      setIsChangingBlock(false);
    }
  };

  const submitReport = async (reason: ReportReason, details: string) => {
    if (!profile) return;
    await reportUserOrMessage({ userId: profile.id, reason, details });
    setReportVisible(false);
    setReportSuccess(true);
  };

  const chatUnavailableText = relationship?.blocked_by_me
    ? 'You blocked this user. Unblock them before sending direct messages.'
    : relationship?.can_start_direct === false
      ? 'Direct messaging is currently unavailable for this profile.'
      : null;

  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    // Web refreshes/deep links can open this profile without a navigator history entry.
    // Search is the safest authenticated fallback and avoids an unhandled GO_BACK action.
    router.replace('/search');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={goBackSafely} style={({ pressed }) => [styles.backButton, pressed && { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={23} color={theme.colors.primary} />
        </Pressable>
        <AppText variant="subheading" style={styles.headerTitle}>Profile</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator accessibilityLabel="Loading profile" accessibilityRole="progressbar" size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Loading profile…</AppText>
        </View>
      ) : error || !profile ? (
        <View style={styles.centerState}>
          <EmptyState icon={{ ios: 'person.crop.circle.badge.exclamationmark', android: 'person_off', web: 'person_off' }} title="Profile unavailable" description={error ?? 'This profile is unavailable.'} />
          <View style={styles.actionWidth}><AppButton label="Try again" variant="secondary" onPress={() => void loadProfile()} /></View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            <Avatar name={profile.display_name} uri={getAvatarPublicUrl(profile.avatar_path)} size={100} />
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

          {chatUnavailableText ? (
            <SurfaceCard style={styles.card}>
              <AppText variant="bodyStrong">Direct messaging unavailable</AppText>
              <AppText variant="caption" tone="secondary">{chatUnavailableText}</AppText>
            </SurfaceCard>
          ) : null}

          <View style={styles.actionArea}>
            <AppButton
              label={relationship?.has_direct_conversation ? 'Open chat' : 'Start chat'}
              icon={{ ios: 'message.fill', android: 'chat', web: 'chat' }}
              loading={isStartingChat}
              disabled={relationship?.can_start_direct === false}
              onPress={() => void startChat()}
            />
            <View style={styles.safetyActions}>
              <View style={styles.safetyCell}>
                <AppButton
                  label={relationship?.blocked_by_me ? 'Unblock' : 'Block'}
                  variant={relationship?.blocked_by_me ? 'secondary' : 'danger'}
                  loading={isChangingBlock}
                  onPress={() => setConfirmBlockVisible(true)}
                />
              </View>
              <View style={styles.safetyCell}>
                <AppButton label="Report" variant="secondary" onPress={() => setReportVisible(true)} />
              </View>
            </View>
            {reportSuccess ? <AppText variant="caption" tone="secondary" style={styles.centerText}>Report submitted privately for review.</AppText> : null}
            {actionError ? <AppText accessibilityLiveRegion="assertive" accessibilityRole="alert" variant="caption" tone="danger" style={styles.centerText}>{actionError}</AppText> : null}
          </View>

          <SurfaceCard style={styles.card}>
            <View style={styles.privacyRow}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
                <AppIcon name={{ ios: 'lock.shield', android: 'shield_lock', web: 'shield_lock' }} size={21} color={theme.colors.primary} />
              </View>
              <View style={styles.privacyCopy}>
                <AppText variant="bodyStrong">Privacy enforced server-side</AppText>
                <AppText variant="caption" tone="secondary">Blocks and contact privacy are enforced by database authorization, not only by this screen.</AppText>
              </View>
            </View>
          </SurfaceCard>
        </ScrollView>
      )}

      <ConfirmActionModal
        visible={confirmBlockVisible}
        title={relationship?.blocked_by_me ? 'Unblock user?' : 'Block user?'}
        message={relationship?.blocked_by_me
          ? `${profile?.display_name ?? 'This user'} will be able to use the existing direct conversation again.`
          : `Direct messages, typing, activity visibility and direct push notifications between you and ${profile?.display_name ?? 'this user'} will stop. Shared group messages remain visible.`}
        confirmLabel={relationship?.blocked_by_me ? 'Unblock' : 'Block'}
        destructive={!relationship?.blocked_by_me}
        loading={isChangingBlock}
        onCancel={() => setConfirmBlockVisible(false)}
        onConfirm={() => void changeBlock()}
      />

      <ReportModal
        visible={reportVisible}
        targetLabel={profile?.display_name ?? 'this user'}
        onClose={() => setReportVisible(false)}
        onSubmit={submitReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 4 },
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
  actionArea: { paddingTop: 4, gap: 10 },
  safetyActions: { flexDirection: 'row', gap: 10 },
  safetyCell: { flex: 1 },
});

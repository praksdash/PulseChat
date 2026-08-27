import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, Avatar, ConfirmActionModal, EmptyState, SurfaceCard } from '@/components/ui';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { listMyBlockedUsers, unblockUser } from '@/services/privacy-service';
import { useAppTheme } from '@/theme';
import type { BlockedUser } from '@/types/privacy';

export default function BlockedUsersScreen() {
  const theme = useAppTheme();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedUser | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsers(await listMyBlockedUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load blocked users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const confirmUnblock = async () => {
    if (!pendingUnblock || isUnblocking) return;
    setIsUnblocking(true);
    setError(null);
    try {
      await unblockUser(pendingUnblock.user_id);
      setUsers((current) => current.filter((item) => item.user_id !== pendingUnblock.user_id));
      setPendingUnblock(null);
    } catch (unblockError) {
      setError(unblockError instanceof Error ? unblockError.message : 'Unable to unblock this user.');
    } finally {
      setIsUnblocking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={23} color={theme.colors.primary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="subheading">Blocked users</AppText>
          <AppText variant="micro" tone="secondary">Manage direct-contact blocks</AppText>
        </View>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : users.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'hand.raised', android: 'block', web: 'block' }}
            title="No blocked users"
            description="People you block will appear here so you can unblock them later."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {users.map((item) => (
            <SurfaceCard key={item.user_id} style={styles.userCard}>
              <Avatar name={item.display_name} uri={getAvatarPublicUrl(item.avatar_path)} size={48} />
              <View style={styles.userCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{item.display_name}</AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>{item.username ? `@${item.username}` : 'PulseChat user'}</AppText>
              </View>
              <View style={styles.unblockButton}>
                <AppButton label="Unblock" variant="secondary" fullWidth={false} onPress={() => setPendingUnblock(item)} />
              </View>
            </SurfaceCard>
          ))}
          {error ? <AppText variant="caption" tone="danger" style={styles.error}>{error}</AppText> : null}
        </ScrollView>
      )}

      <ConfirmActionModal
        visible={Boolean(pendingUnblock)}
        title="Unblock user?"
        message={pendingUnblock ? `${pendingUnblock.display_name} will be able to message you again if an existing direct chat is available, and may appear in search according to your privacy settings.` : ''}
        confirmLabel="Unblock"
        loading={isUnblocking}
        onCancel={() => setPendingUnblock(null)}
        onConfirm={() => void confirmUnblock()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center', gap: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  content: { padding: 16, gap: 10, paddingBottom: 36 },
  userCard: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  userCopy: { flex: 1, gap: 2 },
  unblockButton: { minWidth: 92 },
  error: { textAlign: 'center', paddingTop: 6 },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, ConfirmActionModal, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { deleteMyAccount } from '@/services/account-service';
import { clearUserOfflineCache } from '@/services/offline-cache-service';
import { clearPendingTextMessages } from '@/services/offline-outbox-service';
import { useAppTheme } from '@/theme';

export default function AccountSettingsScreen() {
  const theme = useAppTheme();
  const { user, signOut } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut || isDeleting) return;
    setError(null);
    setIsSigningOut(true);
    try {
      const signOutError = await signOut();
      if (signOutError) setError(signOutError);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteMyAccount();
      if (user?.id) {
        await Promise.allSettled([
          clearUserOfflineCache(user.id),
          clearPendingTextMessages(user.id),
        ]);
      }
      setShowDelete(false);
      const signOutError = await signOut();
      if (signOutError) {
        // The server-side account deletion already succeeded. A best-effort
        // local sign-out is attempted by AuthProvider; the next auth refresh
        // will also invalidate the deleted user's session.
        console.warn('Account deleted but local sign out returned:', signOutError);
      }
      router.replace('/login');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete your account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile/settings')} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} color={theme.colors.text} />
        </Pressable>
        <View>
          <AppText variant="heading">Account</AppText>
          <AppText variant="caption" tone="secondary">Session and account controls</AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceCard style={styles.card}>
          <AppText variant="captionStrong" tone="secondary">SIGNED IN AS</AppText>
          <AppText variant="bodyStrong">{user?.email ?? 'PulseChat account'}</AppText>
          <AppText variant="caption" tone="secondary">User ID: {user?.id ?? 'Unavailable'}</AppText>
        </SurfaceCard>

        <AppButton
          label="Sign out"
          variant="secondary"
          loading={isSigningOut}
          disabled={isDeleting}
          icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
          onPress={() => void handleSignOut()}
        />

        <SurfaceCard style={[styles.dangerCard, { borderColor: theme.colors.danger }]}>
          <AppText variant="bodyStrong" tone="danger">Delete account</AppText>
          <AppText variant="caption" tone="secondary">
            Permanently removes your account, profile, memberships, blocks, notification registrations and settings. Messages and photos already shared in conversations remain as anonymized chat history.
          </AppText>
          <AppButton
            label="Delete my account"
            variant="danger"
            disabled={isSigningOut || isDeleting}
            onPress={() => setShowDelete(true)}
          />
        </SurfaceCard>

        {error ? <AppText variant="caption" tone="danger">{error}</AppText> : null}
      </ScrollView>

      <ConfirmActionModal
        visible={showDelete}
        title="Permanently delete account?"
        message="This cannot be undone. Group ownership is handed to another member when possible before your account is removed."
        confirmLabel="Delete account"
        destructive
        loading={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  card: { padding: 18, gap: 6 },
  dangerCard: { padding: 18, gap: 12, borderWidth: StyleSheet.hairlineWidth },
});

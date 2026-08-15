import { Href, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, SurfaceCard } from '@/components/ui';
import { useAppTheme } from '@/theme';

export default function LoginScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: theme.colors.primary }, theme.shadows.floating]}>
              <AppIcon
                name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
                size={38}
                color="#FFFFFF"
              />
            </View>
            <AppText variant="hero">PulseChat</AppText>
            <AppText tone="secondary" style={styles.centerText}>
              A fast, focused messenger built for everyday conversations.
            </AppText>
          </View>

          <SurfaceCard style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText variant="heading">Welcome back</AppText>
              <AppText variant="caption" tone="secondary">Sign in UI is ready. Supabase connects in Phase 4.</AppText>
            </View>

            <AppTextField
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              leftIcon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
            />
            <AppTextField
              label="Password"
              autoCapitalize="none"
              placeholder="Enter your password"
              passwordToggle
              leftIcon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            />

            <AppButton label="Preview PulseChat" onPress={() => router.replace('/chats' as Href)} />
            <AppButton
              label="Create an account"
              variant="ghost"
              onPress={() => router.push('/register' as Href)}
            />
          </SurfaceCard>

          <AppText variant="micro" tone="tertiary" style={styles.footer}>
            Phase 3 design preview • No credentials are sent anywhere yet
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 32, gap: 28 },
  brand: { alignItems: 'center', gap: 8 },
  logo: { width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  centerText: { textAlign: 'center', maxWidth: 330 },
  card: { padding: 18, gap: 16 },
  cardHeader: { gap: 4, marginBottom: 2 },
  footer: { textAlign: 'center' },
});

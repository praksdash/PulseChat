import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useAppTheme } from '@/theme';
import { hasErrors, validateLogin, type LoginErrors } from '@/utils/auth-validation';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { configurationError, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    const nextErrors = validateLogin(email, password);
    setErrors(nextErrors);
    setFormError(null);

    if (hasErrors(nextErrors)) return;

    setIsSubmitting(true);
    try {
      const error = await signIn(email, password);
      if (error) setFormError(error);
      // Successful auth updates AuthProvider. Stack.Protected moves into the app automatically.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: theme.colors.primary }, theme.shadows.floating]}>
              <AppIcon
                name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
                size={38}
                color={theme.colors.onPrimary}
              />
            </View>
            <AppText variant="hero">PulseChat</AppText>
            <AppText tone="secondary" style={styles.centerText}>
              Sign in to continue your conversations.
            </AppText>
          </View>

          <SurfaceCard style={styles.card}>
            <View style={styles.cardHeader}>
              <AppText variant="heading">Welcome back</AppText>
              <AppText variant="caption" tone="secondary">
                Your session will stay signed in across app restarts until you sign out.
              </AppText>
            </View>

            {configurationError ? (
              <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.warning }]}> 
                <AppIcon
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  size={18}
                  color={theme.colors.warning}
                />
                <AppText variant="caption" style={styles.noticeText}>{configurationError}</AppText>
              </View>
            ) : null}

            {formError ? (
              <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.danger }]}> 
                <AppIcon
                  name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                  size={18}
                  color={theme.colors.danger}
                />
                <AppText variant="caption" tone="danger" style={styles.noticeText}>{formError}</AppText>
              </View>
            ) : null}

            <AppTextField
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
              }}
              error={errors.email}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              returnKeyType="next"
              leftIcon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
            />
            <AppTextField
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
              }}
              error={errors.password}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              placeholder="Enter your password"
              passwordToggle
              returnKeyType="done"
              onSubmitEditing={() => void handleSignIn()}
              leftIcon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            />

            <AppButton
              label="Sign in"
              loading={isSubmitting}
              disabled={Boolean(configurationError)}
              onPress={() => void handleSignIn()}
            />
            <AppButton
              label="Create an account"
              variant="ghost"
              disabled={isSubmitting}
              onPress={() => router.push('/register')}
            />
          </SurfaceCard>

          <AppText variant="micro" tone="tertiary" style={styles.footer}>
            PulseChat • Supabase authentication
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
  notice: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 12, gap: 9 },
  noticeText: { flex: 1 },
  footer: { textAlign: 'center' },
});

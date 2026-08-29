import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useAppTheme } from '@/theme';
import { hasErrors, validateRegistration, type RegisterErrors } from '@/utils/auth-validation';

export default function RegisterScreen() {
  const theme = useAppTheme();
  const { configurationError, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    const nextErrors = validateRegistration(displayName, email, password, confirmPassword);
    setErrors(nextErrors);
    setFormError(null);
    setSuccessMessage(null);

    if (hasErrors(nextErrors)) return;

    setIsSubmitting(true);
    try {
      const result = await signUp(displayName, email, password);
      if (result.error) {
        setFormError(result.error);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setSuccessMessage('Account created. Check your email to confirm the account, then return and sign in.');
        setPassword('');
        setConfirmPassword('');
      }
      // If email confirmation is disabled, Supabase creates a session and protected routing opens the app.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.primarySoft }]}>
              <AppIcon
                name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
                size={30}
                color={theme.colors.primary}
              />
            </View>
            <AppText variant="title">Create your account</AppText>
            <AppText tone="secondary">
              Create your account now, then personalize your username, photo and bio from Profile.
            </AppText>
          </View>

          <SurfaceCard style={styles.card}>
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
                <AppText variant="caption" tone="danger" style={styles.noticeText}>{formError}</AppText>
              </View>
            ) : null}

            {successMessage ? (
              <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.success }]}> 
                <AppIcon
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={18}
                  color={theme.colors.success}
                />
                <AppText variant="caption" tone="success" style={styles.noticeText}>{successMessage}</AppText>
              </View>
            ) : null}

            <AppTextField
              label="Display name"
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value);
                if (errors.displayName) setErrors((current) => ({ ...current, displayName: undefined }));
              }}
              error={errors.displayName}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Your name"
              leftIcon={{ ios: 'person.fill', android: 'person', web: 'person' }}
            />
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
              autoComplete="new-password"
              placeholder="Create a password"
              passwordToggle
              helperText="Use at least 8 characters."
              leftIcon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            />
            <AppTextField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              placeholder="Enter password again"
              passwordToggle
              returnKeyType="done"
              onSubmitEditing={() => void handleSignUp()}
              leftIcon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            />

            <AppButton
              label="Create account"
              loading={isSubmitting}
              disabled={Boolean(configurationError) || Boolean(successMessage)}
              onPress={() => void handleSignUp()}
            />

            {successMessage ? (
              <AppButton label="Back to sign in" variant="secondary" onPress={() => router.replace('/login')} />
            ) : (
              <AppButton label="Back to sign in" variant="ghost" disabled={isSubmitting} onPress={() => router.canGoBack() ? router.back() : router.replace('/login')} />
            )}
          </SurfaceCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 24 },
  header: { gap: 9 },
  iconBox: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  card: { padding: 18, gap: 16 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 14, padding: 12, gap: 9 },
  noticeText: { flex: 1 },
});

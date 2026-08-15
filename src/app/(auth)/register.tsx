import { Href, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, SurfaceCard } from '@/components/ui';
import { useAppTheme } from '@/theme';

export default function RegisterScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              Profile persistence and validation are connected with Supabase Auth in Phase 4.
            </AppText>
          </View>

          <SurfaceCard style={styles.card}>
            <AppTextField
              label="Display name"
              placeholder="Your name"
              leftIcon={{ ios: 'person.fill', android: 'person', web: 'person' }}
            />
            <AppTextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              leftIcon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
            />
            <AppTextField
              label="Password"
              autoCapitalize="none"
              placeholder="Create a password"
              passwordToggle
              helperText="Validation rules arrive with real authentication."
              leftIcon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            />
            <AppButton label="Preview registered state" onPress={() => router.replace('/chats' as Href)} />
            <AppButton label="Back to sign in" variant="ghost" onPress={() => router.back()} />
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
});

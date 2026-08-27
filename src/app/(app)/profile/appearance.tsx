import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText, SurfaceCard } from '@/components/ui';
import { useAppTheme, type ThemePreference } from '@/theme';

const OPTIONS: Array<{ value: ThemePreference; title: string; description: string; icon: any }> = [
  { value: 'system', title: 'System', description: 'Follow your device light or dark appearance', icon: { ios: 'circle.lefthalf.filled', android: 'brightness_auto', web: 'brightness_auto' } },
  { value: 'light', title: 'Light', description: 'Always use the light PulseChat theme', icon: { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' } },
  { value: 'dark', title: 'Dark', description: 'Always use the dark PulseChat theme', icon: { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' } },
];

export default function AppearanceSettingsScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile/settings')} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} color={theme.colors.text} />
        </Pressable>
        <View>
          <AppText variant="heading">Appearance</AppText>
          <AppText variant="caption" tone="secondary">Choose how PulseChat looks</AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceCard style={styles.card}>
          {OPTIONS.map((option, index) => {
            const selected = theme.preference === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => void theme.setPreference(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  index < OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
                  pressed && { backgroundColor: theme.colors.surfaceMuted },
                ]}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.primarySoft }]}>
                  <AppIcon name={option.icon} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.copy}>
                  <AppText variant="bodyStrong">{option.title}</AppText>
                  <AppText variant="caption" tone="secondary">{option.description}</AppText>
                </View>
                <AppIcon
                  name={selected
                    ? { ios: 'checkmark.circle.fill', android: 'radio_button_checked', web: 'radio_button_checked' }
                    : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
                  size={22}
                  color={selected ? theme.colors.primary : theme.colors.textTertiary}
                />
              </Pressable>
            );
          })}
        </SurfaceCard>
        <AppText variant="caption" tone="secondary" style={styles.note}>
          Appearance is stored on this device. System mode automatically follows your operating-system theme.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  content: { padding: 18, paddingBottom: 36, gap: 14 },
  card: { overflow: 'hidden' },
  option: { minHeight: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  note: { paddingHorizontal: 6 },
});

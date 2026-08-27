import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, SettingsRow, SurfaceCard } from '@/components/ui';
import { getMyPrivacySettings, listMyBlockedUsers, updateMyPrivacySettings } from '@/services/privacy-service';
import { useAppTheme } from '@/theme';
import type { PrivacySettings } from '@/types/privacy';

const DEFAULT_SETTINGS: PrivacySettings = {
  discoverable_by_search: true,
  allow_new_direct_messages: true,
  show_activity_status: true,
};

function PrivacyToggle({
  title,
  description,
  value,
  onValueChange,
  last = false,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.toggleRow, !last && { borderBottomColor: theme.colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.toggleCopy}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="secondary">{description}</AppText>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function PrivacyScreen() {
  const theme = useAppTheme();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [blockedCount, setBlockedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextSettings, blocked] = await Promise.all([
        getMyPrivacySettings(),
        listMyBlockedUsers(),
      ]);
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setBlockedCount(blocked.length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load privacy settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [savedSettings, settings]);

  const save = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const next = await updateMyPrivacySettings(settings);
      setSettings(next);
      setSavedSettings(next);
      setSavedMessage('Privacy settings saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save privacy settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={23} color={theme.colors.primary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="subheading">Privacy & security</AppText>
          <AppText variant="micro" tone="secondary">Control discovery and contact</AppText>
        </View>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Loading privacy controls…</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <AppText variant="captionStrong" tone="secondary" style={styles.sectionTitle}>PRIVACY</AppText>
            <SurfaceCard style={styles.settingsCard}>
              <PrivacyToggle
                title="Appear in people search"
                description="When off, your profile is hidden from People search. Existing conversation members can still open your safe profile from a chat."
                value={settings.discoverable_by_search}
                onValueChange={(value) => setSettings((current) => ({ ...current, discoverable_by_search: value }))}
              />
              <PrivacyToggle
                title="Allow new direct chats"
                description="When off, existing direct chats continue to work, but new people cannot open a direct conversation with you."
                value={settings.allow_new_direct_messages}
                onValueChange={(value) => setSettings((current) => ({ ...current, allow_new_direct_messages: value }))}
              />
              <PrivacyToggle
                title="Show online & last seen"
                description="When off, other conversation members cannot subscribe to your activity status or read your last-seen time."
                value={settings.show_activity_status}
                onValueChange={(value) => setSettings((current) => ({ ...current, show_activity_status: value }))}
                last
              />
            </SurfaceCard>
          </View>

          <AppButton label="Save privacy settings" loading={isSaving} disabled={!isDirty} onPress={() => void save()} />
          {savedMessage ? <AppText variant="caption" tone="secondary" style={styles.feedback}>{savedMessage}</AppText> : null}
          {error ? <AppText variant="caption" tone="danger" style={styles.feedback}>{error}</AppText> : null}

          <View style={styles.section}>
            <AppText variant="captionStrong" tone="secondary" style={styles.sectionTitle}>SAFETY</AppText>
            <SurfaceCard style={styles.settingsCard}>
              <SettingsRow
                icon={{ ios: 'hand.raised.fill', android: 'block', web: 'block' }}
                title="Blocked users"
                subtitle={`${blockedCount} blocked ${blockedCount === 1 ? 'user' : 'users'}`}
                onPress={() => router.push('/profile/blocked-users')}
                last
              />
            </SurfaceCard>
          </View>

          <SurfaceCard style={styles.infoCard}>
            <AppText variant="bodyStrong">What blocking does</AppText>
            <AppText variant="caption" tone="secondary">
              Blocking closes direct messaging in both directions, hides activity and typing between the pair, prevents new direct pushes, and removes both users from each other's people search. Shared group messages remain available to group members.
            </AppText>
          </SurfaceCard>

          <SurfaceCard style={styles.infoCard}>
            <AppText variant="bodyStrong">Reports stay private</AppText>
            <AppText variant="caption" tone="secondary">
              Reports are stored separately for moderation review. Other users cannot browse the report table or see who reported them.
            </AppText>
          </SurfaceCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center', gap: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  section: { gap: 8 },
  sectionTitle: { paddingLeft: 4 },
  settingsCard: { overflow: 'hidden' },
  toggleRow: { minHeight: 80, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleCopy: { flex: 1, gap: 3 },
  feedback: { textAlign: 'center' },
  infoCard: { padding: 16, gap: 5 },
});

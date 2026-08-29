import { Pressable, StyleSheet, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type SettingsRowProps = {
  icon: SymbolViewProps['name'];
  title: string;
  subtitle?: string;
  onPress?: () => void;
  last?: boolean;
};

export function SettingsRow({ icon, title, subtitle, onPress, last = false }: SettingsRowProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle ? `${subtitle}. Opens details.` : 'Opens details'}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.colors.surfaceMuted }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.colors.primarySoft }]}>
        <AppIcon name={icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={[styles.body, !last && { borderBottomColor: theme.colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">{title}</AppText>
          {subtitle ? <AppText variant="caption" tone="secondary">{subtitle}</AppText> : null}
        </View>
        <AppIcon
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={18}
          color={theme.colors.textTertiary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  copy: { flex: 1, gap: 2 },
});

import { Pressable, StyleSheet, Switch, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type SettingsToggleRowProps = {
  icon: SymbolViewProps['name'];
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
};

export function SettingsToggleRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  last = false,
}: SettingsToggleRowProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.surfaceMuted },
        disabled && styles.disabled,
      ]}>
      <View style={[styles.iconBox, { backgroundColor: theme.colors.primarySoft }]}>
        <AppIcon name={icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={[styles.body, !last && { borderBottomColor: theme.colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">{title}</AppText>
          {subtitle ? <AppText variant="caption" tone="secondary">{subtitle}</AppText> : null}
        </View>
        <Switch
          accessible={false}
          pointerEvents="none"
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }}
          thumbColor={value ? theme.colors.primary : theme.colors.textTertiary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 68, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 14 },
  copy: { flex: 1, gap: 2 },
  disabled: { opacity: 0.55 },
});

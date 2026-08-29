import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';
import type { SymbolViewProps } from 'expo-symbols';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: SymbolViewProps['name'];
  fullWidth?: boolean;
};

export function AppButton({
  label,
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  fullWidth = true,
  accessibilityLabel,
  accessibilityState,
  ...props
}: AppButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;

  const palette = {
    primary: {
      background: theme.colors.primary,
      pressed: theme.colors.primaryPressed,
      text: theme.colors.onPrimary,
      border: theme.colors.primary,
    },
    secondary: {
      background: theme.colors.primarySoft,
      pressed: theme.colors.surfaceMuted,
      text: theme.colors.primary,
      border: theme.colors.primarySoft,
    },
    ghost: {
      background: 'transparent',
      pressed: theme.colors.surfaceMuted,
      text: theme.colors.primary,
      border: 'transparent',
    },
    danger: {
      background: theme.colors.danger,
      pressed: theme.colors.danger,
      text: theme.colors.onDanger,
      border: theme.colors.danger,
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        ...accessibilityState,
        disabled: isDisabled,
        busy: loading,
      }}
      disabled={isDisabled}
      {...props}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: pressed ? palette.pressed : palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={`${label}, in progress`}
          accessibilityRole="progressbar"
          color={palette.text}
        />
      ) : (
        <View style={styles.content}>
          {icon ? <AppIcon name={icon} size={18} color={palette.text} /> : null}
          <AppText variant="bodyStrong" style={{ color: palette.text }}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

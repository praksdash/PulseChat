import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type AppTextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: SymbolViewProps['name'];
  passwordToggle?: boolean;
};

export function AppTextField({
  label,
  helperText,
  error,
  leftIcon,
  passwordToggle = false,
  secureTextEntry,
  style,
  ...props
}: AppTextFieldProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const shouldHidePassword = passwordToggle ? !passwordVisible : secureTextEntry;

  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="captionStrong">{label}</AppText> : null}
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error
              ? theme.colors.danger
              : focused
                ? theme.colors.primary
                : theme.colors.border,
          },
        ]}>
        {leftIcon ? <AppIcon name={leftIcon} size={20} color={theme.colors.textSecondary} /> : null}
        <TextInput
          {...props}
          secureTextEntry={shouldHidePassword}
          placeholderTextColor={theme.colors.textTertiary}
          selectionColor={theme.colors.primary}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            theme.typography.body,
            { color: theme.colors.text },
            style,
          ]}
        />
        {passwordToggle ? (
          <Pressable
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            hitSlop={10}
            onPress={() => setPasswordVisible((current) => !current)}>
            <AppIcon
              name={
                passwordVisible
                  ? { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }
                  : { ios: 'eye.fill', android: 'visibility', web: 'visibility' }
              }
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="micro" tone="danger">{error}</AppText>
      ) : helperText ? (
        <AppText variant="micro" tone="tertiary">{helperText}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  inputShell: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 0,
  },
});

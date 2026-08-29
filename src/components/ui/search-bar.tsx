import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppIcon } from './app-icon';
import { useAppTheme } from '@/theme';

export function SearchBar({
  style,
  accessibilityLabel,
  allowFontScaling = true,
  maxFontSizeMultiplier = 2,
  ...props
}: TextInputProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceMuted }]}>
      <AppIcon
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        size={20}
        color={theme.colors.textSecondary}
      />
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? 'Search'}
        allowFontScaling={allowFontScaling}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.primary}
        style={[
          styles.input,
          theme.typography.body,
          { color: theme.colors.text },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 46,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 9,
  },
  input: { flex: 1, minHeight: 44, paddingVertical: 0 },
});

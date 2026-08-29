import { Text, type TextProps, type TextStyle } from 'react-native';

import { useAppTheme } from '@/theme';

type TextVariant = 'hero' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'captionStrong' | 'micro';
type TextTone = 'default' | 'secondary' | 'tertiary' | 'primary' | 'success' | 'danger' | 'inverse';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

export function AppText({
  variant = 'body',
  tone = 'default',
  style,
  allowFontScaling = true,
  maxFontSizeMultiplier = 2,
  ...props
}: AppTextProps) {
  const theme = useAppTheme();

  const toneColor: Record<TextTone, string> = {
    default: theme.colors.text,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    primary: theme.colors.primary,
    success: theme.colors.success,
    danger: theme.colors.danger,
    inverse: theme.colors.onPrimary,
  };

  return (
    <Text
      {...props}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        theme.typography[variant] as TextStyle,
        { color: toneColor[tone] },
        style,
      ]}
    />
  );
}

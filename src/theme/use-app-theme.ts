import { useColorScheme } from 'react-native';

import { DarkColors, LightColors, Radius, Shadows, Spacing, Typography } from './tokens';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: isDark ? DarkColors : LightColors,
    spacing: Spacing,
    radius: Radius,
    typography: Typography,
    shadows: Shadows,
  } as const;
}

export type AppTheme = ReturnType<typeof useAppTheme>;

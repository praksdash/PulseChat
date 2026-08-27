import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { DarkColors, LightColors, Radius, Shadows, Spacing, Typography } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'pulsechat.theme.preference.v1';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  isDark: boolean;
  isReady: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
  colors: typeof LightColors | typeof DarkColors;
  spacing: typeof Spacing;
  radius: typeof Radius;
  typography: typeof Typography;
  shadows: typeof Shadows;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (mounted && isThemePreference(stored)) setPreferenceState(stored);
      })
      .catch((error) => console.warn('Unable to restore appearance preference:', error))
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference);
    } catch (error) {
      console.warn('Unable to save appearance preference:', error);
    }
  }, []);

  const resolvedScheme: 'light' | 'dark' = preference === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : preference;
  const isDark = resolvedScheme === 'dark';

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedScheme,
    isDark,
    isReady,
    setPreference,
    colors: isDark ? DarkColors : LightColors,
    spacing: Spacing,
    radius: Radius,
    typography: Typography,
    shadows: Shadows,
  }), [isDark, isReady, preference, resolvedScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

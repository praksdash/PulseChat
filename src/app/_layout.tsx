import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthLoadingScreen } from '@/components/auth';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/auth-provider';
import { ConnectivityProvider } from '@/providers/connectivity-provider';
import { ThemeProvider, useAppTheme } from '@/theme';

function RootNavigator() {
  const theme = useAppTheme();
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <AuthLoadingScreen />;
  }

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'fade',
        }}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ConnectivityProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ConnectivityProvider>
    </ThemeProvider>
  );
}

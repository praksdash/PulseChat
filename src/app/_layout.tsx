import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthLoadingScreen } from '@/components/auth';
import { DiagnosticsBridge } from '@/components/auth/diagnostics-bridge';
import { AppErrorBoundary } from '@/components/system/app-error-boundary';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/auth-provider';
import { ConnectivityProvider } from '@/providers/connectivity-provider';
import { initializeCallMediaRuntime } from '@/services/call-media-runtime';
import { ThemeProvider, useAppTheme } from '@/theme';

// Metro resolves a no-op Web adapter and the LiveKit-backed native adapter.
// Register WebRTC globals before any later call room can be created. Permission
// prompts remain user-action driven and are never shown during app startup.
initializeCallMediaRuntime();

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
    <AppErrorBoundary>
      <ThemeProvider>
        <ConnectivityProvider>
          <AuthProvider>
            <DiagnosticsBridge />
            <RootNavigator />
          </AuthProvider>
        </ConnectivityProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { DevSettings, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { captureDiagnosticError } from '@/services/diagnostics-service';
import { LightColors } from '@/theme/tokens';

type State = { hasError: boolean };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    captureDiagnosticError(error, 'react_render');
  }

  private reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    DevSettings.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View accessibilityRole="alert" style={styles.screen}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>PulseChat needs to restart</Text>
          <Text style={styles.body}>
            A technical problem was recorded without including your messages or personal content.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart PulseChat"
            onPress={this.reload}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Restart app</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: LightColors.background,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    gap: 16,
    padding: 24,
    borderRadius: 20,
    backgroundColor: LightColors.surface,
  },
  title: { color: LightColors.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  body: { color: LightColors.textSecondary, fontSize: 16, lineHeight: 23 },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: LightColors.primary,
  },
  buttonPressed: { backgroundColor: LightColors.primaryPressed },
  buttonText: { color: LightColors.onPrimary, fontSize: 16, lineHeight: 22, fontWeight: '700' },
});

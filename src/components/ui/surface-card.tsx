import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/theme';

export function SurfaceCard({ style, ...props }: ViewProps) {
  const theme = useAppTheme();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        theme.shadows.card,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

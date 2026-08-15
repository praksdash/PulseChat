import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme';

type AppIconProps = {
  name: SymbolViewProps['name'];
  size?: number;
  color?: ColorValue;
  containerStyle?: StyleProp<ViewStyle>;
};

export function AppIcon({ name, size = 22, color, containerStyle }: AppIconProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { width: size, height: size }, containerStyle]}>
      <SymbolView
        name={name}
        size={size}
        tintColor={color ?? theme.colors.text}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

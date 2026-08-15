import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type AvatarProps = {
  name: string;
  size?: number;
  online?: boolean;
  accent?: string;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({ name, size = 52, online = false, accent }: AvatarProps) {
  const theme = useAppTheme();
  const badgeSize = Math.max(12, Math.round(size * 0.26));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accent ?? theme.colors.primary,
          },
        ]}>
        <AppText
          tone="inverse"
          style={{ fontSize: Math.round(size * 0.34), fontWeight: '800' }}>
          {getInitials(name)}
        </AppText>
      </View>
      {online ? (
        <View
          style={[
            styles.online,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: theme.colors.online,
              borderColor: theme.colors.surface,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  online: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2.5,
  },
});

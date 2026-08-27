import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useAppTheme } from '@/theme';

type AvatarProps = {
  name: string;
  uri?: string | null;
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

function AvatarComponent({ name, uri, size = 52, online = false, accent }: AvatarProps) {
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
            overflow: 'hidden',
          },
        ]}>
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="cover"
            transition={140}
            cachePolicy="memory-disk"
            recyclingKey={uri}
            style={{ width: size, height: size }}
          />
        ) : (
          <AppText
            tone="inverse"
            style={{ fontSize: Math.round(size * 0.34), fontWeight: '800' }}>
            {getInitials(name) || 'P'}
          </AppText>
        )}
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

export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  online: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2.5,
  },
});

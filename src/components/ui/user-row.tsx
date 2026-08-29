import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { Avatar } from './avatar';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { useAppTheme } from '@/theme';
import type { PublicUserProfile } from '@/types/user-discovery';

type UserRowProps = {
  user: PublicUserProfile;
  onPress: () => void;
};

export function UserRow({ user, onPress }: UserRowProps) {
  const theme = useAppTheme();
  const avatarUri = getAvatarPublicUrl(user.avatar_path);
  const identity = user.username ? `@${user.username}` : 'PulseChat user';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${user.display_name}, ${identity}${user.bio ? `, ${user.bio}` : ''}`}
      accessibilityHint="Opens profile"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
      ]}>
      <Avatar name={user.display_name} uri={avatarUri} />

      <View style={[styles.body, { borderBottomColor: theme.colors.divider }]}>
        <View style={styles.copy}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {user.display_name}
          </AppText>
          <AppText variant="caption" tone="primary" numberOfLines={1}>
            {identity}
          </AppText>
          {user.bio ? (
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {user.bio}
            </AppText>
          ) : null}
        </View>

        <AppIcon
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={20}
          color={theme.colors.textTertiary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 12,
  },
  body: {
    flex: 1,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
});

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, Avatar, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import {
  deleteAvatar,
  getAvatarPublicUrl,
  isUsernameAvailable,
  uploadAvatar,
} from '@/services/profile-service';
import { useAppTheme } from '@/theme';
import {
  BIO_MAX,
  normalizeUsername,
  validateBio,
  validateDisplayName,
  validateUsername,
} from '@/utils/profile-validation';

type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export default function EditProfileScreen() {
  const theme = useAppTheme();
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(null);
  const [removeExistingAvatar, setRemoveExistingAvatar] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const normalizedUsername = normalizeUsername(username);
  const displayNameError = validateDisplayName(displayName);
  const usernameError = validateUsername(username);
  const bioError = validateBio(bio);

  const storedAvatarUrl = useMemo(
    () => getAvatarPublicUrl(profile?.avatar_path),
    [profile?.avatar_path],
  );
  const avatarUri = selectedAvatarUri || (!removeExistingAvatar ? storedAvatarUrl : null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setUsername(profile.username ?? '');
    setBio(profile.bio ?? '');
  }, [profile]);

  useEffect(() => {
    if (!normalizedUsername || usernameError) {
      setUsernameState('idle');
      return;
    }

    if (normalizedUsername === (profile?.username ?? '')) {
      setUsernameState('available');
      return;
    }

    let cancelled = false;
    setUsernameState('checking');

    const timer = setTimeout(() => {
      void isUsernameAvailable(normalizedUsername)
        .then((available) => {
          if (!cancelled) setUsernameState(available ? 'available' : 'taken');
        })
        .catch(() => {
          if (!cancelled) setUsernameState('error');
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalizedUsername, profile?.username, usernameError]);

  const chooseAvatar = async () => {
    setFormError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Photo access required',
        'Allow PulseChat to access your photos so you can choose a profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setSelectedAvatarUri(asset.uri);
    setRemoveExistingAvatar(false);
  };

  const removeAvatar = () => {
    setSelectedAvatarUri(null);
    setRemoveExistingAvatar(true);
  };

  const saveProfile = async () => {
    if (!user || !profile || isSaving) return;

    setFormError(null);

    if (displayNameError || usernameError || bioError) {
      setFormError(displayNameError || usernameError || bioError);
      return;
    }

    if (normalizedUsername && normalizedUsername !== (profile.username ?? '')) {
      try {
        const available = await isUsernameAvailable(normalizedUsername);
        if (!available) {
          setUsernameState('taken');
          setFormError('That username is already taken.');
          return;
        }
      } catch {
        setFormError('Unable to verify the username right now. Please try again.');
        return;
      }
    }

    setIsSaving(true);
    let uploadedPath: string | null = null;

    try {
      let nextAvatarPath = removeExistingAvatar ? null : profile.avatar_path;

      if (selectedAvatarUri) {
        uploadedPath = await uploadAvatar(user.id, selectedAvatarUri);
        nextAvatarPath = uploadedPath;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: normalizedUsername || null,
          bio: bio.trim() || null,
          avatar_path: nextAvatarPath,
        })
        .eq('id', user.id);

      if (error) {
        if (uploadedPath) await deleteAvatar(uploadedPath);

        if (error.code === '23505') {
          setUsernameState('taken');
          setFormError('That username is already taken.');
        } else {
          setFormError(error.message || 'Unable to save your profile.');
        }
        return;
      }

      if (profile.avatar_path && profile.avatar_path !== nextAvatarPath) {
        await deleteAvatar(profile.avatar_path);
      }

      await refreshProfile();
      router.back();
    } catch (error) {
      if (uploadedPath) await deleteAvatar(uploadedPath);
      setFormError(error instanceof Error ? error.message : 'Unable to save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const usernameHelper = usernameError
    ? undefined
    : usernameState === 'checking'
      ? 'Checking availability…'
      : usernameState === 'available' && normalizedUsername
        ? 'Username is available.'
        : usernameState === 'taken'
          ? undefined
          : usernameState === 'error'
            ? 'Availability check failed. It will be checked again when you save.'
            : 'Optional. People will use this to find you later.';

  const usernameFieldError = usernameError || (usernameState === 'taken' ? 'That username is already taken.' : undefined);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.headerAction}>
            <AppIcon
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
              color={theme.colors.text}
            />
          </Pressable>
          <AppText variant="heading">Edit profile</AppText>
          <View style={styles.headerAction} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <SurfaceCard style={styles.avatarCard}>
            <Avatar name={displayName || 'PulseChat User'} uri={avatarUri} size={104} />
            <View style={styles.avatarActions}>
              <AppButton
                label={avatarUri ? 'Change photo' : 'Choose photo'}
                variant="secondary"
                fullWidth={false}
                icon={{ ios: 'photo.fill', android: 'photo_library', web: 'photo_library' }}
                onPress={() => void chooseAvatar()}
              />
              {avatarUri ? (
                <AppButton
                  label="Remove"
                  variant="ghost"
                  fullWidth={false}
                  onPress={removeAvatar}
                />
              ) : null}
            </View>
            <AppText variant="micro" tone="tertiary" style={styles.centeredText}>
              Photos are cropped square and compressed to 512×512 before upload.
            </AppText>
          </SurfaceCard>

          <View style={styles.form}>
            <AppTextField
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              error={displayNameError ?? undefined}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
              leftIcon={{ ios: 'person.fill', android: 'person', web: 'person' }}
              placeholder="Your name"
            />

            <AppTextField
              label="Username"
              value={username}
              onChangeText={setUsername}
              error={usernameFieldError}
              helperText={usernameHelper}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={33}
              leftIcon={{ ios: 'at', android: 'alternate_email', web: 'alternate_email' }}
              placeholder="username"
            />

            <AppTextField
              label="Bio"
              value={bio}
              onChangeText={setBio}
              error={bioError ?? undefined}
              helperText={`${bio.trim().length}/${BIO_MAX} characters`}
              autoCapitalize="sentences"
              maxLength={BIO_MAX}
              multiline
              numberOfLines={4}
              style={styles.bioInput}
              leftIcon={{ ios: 'text.alignleft', android: 'notes', web: 'notes' }}
              placeholder="A little about you"
            />
          </View>

          {formError ? (
            <SurfaceCard style={[styles.errorCard, { borderColor: theme.colors.danger }]}>
              <AppText variant="caption" tone="danger">{formError}</AppText>
            </SurfaceCard>
          ) : null}

          <AppButton
            label="Save profile"
            loading={isSaving}
            disabled={Boolean(displayNameError || usernameError || bioError || usernameState === 'taken')}
            icon={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
            onPress={() => void saveProfile()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    height: 58,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 40, gap: 20 },
  avatarCard: { padding: 22, alignItems: 'center', gap: 14 },
  avatarActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  centeredText: { textAlign: 'center' },
  form: { gap: 16 },
  bioInput: { minHeight: 92, textAlignVertical: 'top', paddingTop: 14 },
  errorCard: { borderWidth: 1, padding: 14 },
});

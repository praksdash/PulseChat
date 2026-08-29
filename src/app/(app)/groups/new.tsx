import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, Avatar, EmptyState, SearchBar } from '@/components/ui';
import {
  chooseGroupAvatar,
  createGroupConversation,
  updateGroupProfile,
  uploadGroupAvatar,
} from '@/services/group-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { searchUsers } from '@/services/user-discovery-service';
import { useAppTheme } from '@/theme';
import type { GroupAvatarSelection } from '@/types/group';
import type { PublicUserProfile } from '@/types/user-discovery';

const SEARCH_DELAY = 300;
const MAX_GROUP_MEMBERS = 100;

function SelectedPerson({ user, onRemove }: { user: PublicUserProfile; onRemove: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${user.display_name} from selected members`}
      onPress={onRemove}
      style={styles.selectedPerson}>
      <Avatar name={user.display_name} uri={getAvatarPublicUrl(user.avatar_path)} size={40} />
      <AppText variant="micro" numberOfLines={1} style={styles.selectedName}>{user.display_name}</AppText>
      <View style={[styles.removeDot, { backgroundColor: theme.colors.primary }]}> 
        <AppIcon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={12} color={theme.colors.onPrimary} />
      </View>
    </Pressable>
  );
}

export default function NewGroupScreen() {
  const theme = useAppTheme();
  const [title, setTitle] = useState('');
  const [avatar, setAvatar] = useState<GroupAvatarSelection | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [selected, setSelected] = useState<Record<string, PublicUserProfile>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    void searchUsers(debouncedQuery)
      .then((rows) => {
        if (requestId.current !== currentRequest) return;
        setResults(rows);
      })
      .catch((searchError) => {
        if (requestId.current !== currentRequest) return;
        console.warn('Unable to search group members:', searchError);
        setError('Unable to search people right now.');
      })
      .finally(() => {
        if (requestId.current === currentRequest) setIsSearching(false);
      });
  }, [debouncedQuery]);

  const selectedPeople = useMemo(() => Object.values(selected), [selected]);
  const canCreate = title.trim().length > 0 && selectedPeople.length >= 1 && !isCreating;

  const togglePerson = (user: PublicUserProfile) => {
    setSelected((current) => {
      if (current[user.id]) {
        const next = { ...current };
        delete next[user.id];
        return next;
      }
      if (Object.keys(current).length >= MAX_GROUP_MEMBERS - 1) return current;
      return { ...current, [user.id]: user };
    });
  };

  const chooseAvatar = async () => {
    setError(null);
    try {
      const picked = await chooseGroupAvatar();
      if (picked) setAvatar(picked);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Unable to choose group picture.');
    }
  };

  const createGroup = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);

    try {
      const conversationId = await createGroupConversation(title, selectedPeople.map((person) => person.id));
      if (avatar) {
        try {
          const path = await uploadGroupAvatar(conversationId, avatar.uri);
          await updateGroupProfile({ conversationId, title, avatarPath: path });
        } catch (avatarError) {
          console.warn('Group created but avatar upload failed:', avatarError);
        }
      }

      router.replace({
        pathname: '/chat/[conversationId]',
        params: { conversationId, name: title.trim() },
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the group.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to chats"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/chats')}
          style={styles.roundButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={24} color={theme.colors.primary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong">New group</AppText>
          <AppText variant="micro" tone="secondary">{selectedPeople.length + 1} member{selectedPeople.length === 0 ? '' : 's'} including you</AppText>
        </View>
      </View>

      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.identityRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={avatar ? 'Change group photo' : 'Add group photo'}
            onPress={() => void chooseAvatar()}
            style={[styles.avatarButton, { backgroundColor: theme.colors.primarySoft }]}> 
            {avatar ? (
              <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
            ) : (
              <AppIcon name={{ ios: 'camera.fill', android: 'add_a_photo', web: 'add_a_photo' }} size={28} color={theme.colors.primary} />
            )}
          </Pressable>
          <View style={styles.titleField}>
            <AppTextField
              label="Group name"
              value={title}
              onChangeText={setTitle}
              placeholder="Family, Project team…"
              maxLength={100}
              returnKeyType="done"
            />
          </View>
        </View>

        {selectedPeople.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="captionStrong" tone="secondary">SELECTED</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedList}>
              {selectedPeople.map((person) => (
                <SelectedPerson key={person.id} user={person} onRemove={() => togglePerson(person)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="captionStrong" tone="secondary">ADD MEMBERS</AppText>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or username"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {isSearching ? (
          <View style={styles.searchState}>
            <ActivityIndicator accessibilityLabel="Searching for members" accessibilityRole="progressbar" color={theme.colors.primary} />
            <AppText variant="caption" tone="secondary">Searching…</AppText>
          </View>
        ) : debouncedQuery.length < 2 ? (
          <EmptyState
            icon={{ ios: 'person.3', android: 'group', web: 'group' }}
            title="Choose group members"
            description="Search by display name or username, then tap people to add them."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_search', web: 'person_search' }}
            title="No people found"
            description="Try another name or username."
          />
        ) : (
          <View>
            {results.map((item) => {
              const checked = Boolean(selected[item.id]);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${item.display_name}${item.username ? `, @${item.username}` : ''}`}
                  accessibilityState={{ checked }}
                  onPress={() => togglePerson(item)}
                  style={({ pressed }) => [
                    styles.personRow,
                    { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface },
                  ]}>
                  <Avatar name={item.display_name} uri={getAvatarPublicUrl(item.avatar_path)} />
                  <View style={[styles.personCopy, { borderBottomColor: theme.colors.divider }]}>
                    <View style={styles.personText}>
                      <AppText variant="bodyStrong" numberOfLines={1}>{item.display_name}</AppText>
                      <AppText variant="caption" tone="secondary" numberOfLines={1}>
                        {item.username ? `@${item.username}` : 'PulseChat user'}
                      </AppText>
                    </View>
                    <View style={[
                      styles.checkCircle,
                      {
                        borderColor: checked ? theme.colors.primary : theme.colors.border,
                        backgroundColor: checked ? theme.colors.primary : 'transparent',
                      },
                    ]}>
                      {checked ? <AppIcon name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={15} color={theme.colors.onPrimary} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {error ? <AppText accessibilityLiveRegion="assertive" accessibilityRole="alert" variant="caption" tone="danger">{error}</AppText> : null}
        <AppButton
          label={isCreating ? 'Creating group…' : `Create group (${selectedPeople.length + 1})`}
          loading={isCreating}
          disabled={!canCreate}
          icon={{ ios: 'person.3.fill', android: 'group_add', web: 'group_add' }}
          onPress={() => void createGroup()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  content: { padding: 18, paddingBottom: 42, gap: 22 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarButton: { width: 78, height: 78, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  titleField: { flex: 1 },
  section: { gap: 10 },
  selectedList: { gap: 12, paddingRight: 12 },
  selectedPerson: { width: 64, alignItems: 'center', gap: 5, position: 'relative' },
  selectedName: { width: 64, textAlign: 'center' },
  removeDot: { position: 'absolute', top: -2, right: 5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  searchState: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 8 },
  personRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingLeft: 4, gap: 12 },
  personCopy: { flex: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  personText: { flex: 1, gap: 2 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
});

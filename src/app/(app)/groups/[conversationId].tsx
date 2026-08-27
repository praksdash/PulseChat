import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, AppTextField, Avatar, EmptyState, SearchBar } from '@/components/ui';
import { getConversationSummary } from '@/services/conversation-service';
import { subscribeToGroupMembershipEvents } from '@/services/group-membership-events';
import {
  addGroupMembers,
  chooseGroupAvatar,
  getGroupAvatarPublicUrl,
  leaveGroupConversation,
  listGroupMembers,
  removeGroupAvatarObject,
  removeGroupMember,
  setGroupMemberRole,
  transferGroupOwnership,
  updateGroupProfile,
  uploadGroupAvatar,
} from '@/services/group-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { searchUsers } from '@/services/user-discovery-service';
import { useAppTheme } from '@/theme';
import type { ConversationSummary } from '@/types/conversation';
import type { GroupMember } from '@/types/group';
import type { PublicUserProfile } from '@/types/user-discovery';

function askConfirmation(title: string, message: string, actionLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    const confirmFn = (globalThis as typeof globalThis & { confirm?: (value?: string) => boolean }).confirm;
    if (confirmFn?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function RoleBadge({ role }: { role: GroupMember['role'] }) {
  const theme = useAppTheme();
  const label = role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Member';
  return (
    <View style={[styles.roleBadge, { backgroundColor: role === 'member' ? theme.colors.surfaceMuted : theme.colors.primarySoft }]}>
      <AppText variant="micro" tone={role === 'member' ? 'secondary' : 'primary'}>{label}</AppText>
    </View>
  );
}

export default function GroupInfoScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;

  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<PublicUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchSequence = useRef(0);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [nextSummary, nextMembers] = await Promise.all([
        getConversationSummary(conversationId),
        listGroupMembers(conversationId),
      ]);
      if (!nextSummary || nextSummary.kind !== 'group') throw new Error('This group is unavailable.');
      setSummary(nextSummary);
      setTitle(nextSummary.display_name);
      setMembers(nextMembers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this group.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { void load(); }, [load]);


  useEffect(() => subscribeToGroupMembershipEvents((event) => {
    if (!conversationId || event.conversationId !== conversationId) return;
    if (event.changeType === 'removed' || event.changeType === 'left') {
      router.replace('/chats');
      return;
    }
    void load();
  }), [conversationId, load]);

  useEffect(() => {
    const current = ++searchSequence.current;
    const normalized = addQuery.trim();
    if (normalized.length < 2 || !summary || !['owner', 'admin'].includes(summary.my_role)) {
      setAddResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      void searchUsers(normalized)
        .then((rows) => {
          if (searchSequence.current !== current) return;
          const memberIds = new Set(members.map((member) => member.user_id));
          setAddResults(rows.filter((row) => !memberIds.has(row.id)));
        })
        .catch((searchError) => {
          if (searchSequence.current !== current) return;
          console.warn('Unable to search new group members:', searchError);
        })
        .finally(() => {
          if (searchSequence.current === current) setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [addQuery, members, summary]);

  const canManage = summary?.my_role === 'owner' || summary?.my_role === 'admin';
  const isOwner = summary?.my_role === 'owner';
  const avatarUri = getGroupAvatarPublicUrl(summary?.avatar_path);
  const memberCount = summary?.member_count ?? members.length;

  const saveProfile = async (nextAvatarPath = summary?.avatar_path ?? null) => {
    if (!conversationId || !summary || !canManage || !title.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateGroupProfile({ conversationId, title, avatarPath: nextAvatarPath });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update group.');
    } finally {
      setIsSaving(false);
    }
  };

  const changeAvatar = async () => {
    if (!conversationId || !summary || !canManage) return;
    setError(null);
    try {
      const selected = await chooseGroupAvatar();
      if (!selected) return;
      setIsSaving(true);
      const oldPath = summary.avatar_path;
      const newPath = await uploadGroupAvatar(conversationId, selected.uri);
      await updateGroupProfile({ conversationId, title: title || summary.display_name, avatarPath: newPath });
      if (oldPath && oldPath !== newPath) void removeGroupAvatarObject(oldPath);
      await load();
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : 'Unable to update group picture.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeAvatar = () => {
    if (!conversationId || !summary?.avatar_path || !canManage) return;
    const oldPath = summary.avatar_path;
    askConfirmation('Remove group picture?', 'The group will return to its initials avatar.', 'Remove', () => {
      void (async () => {
        setIsSaving(true);
        try {
          await updateGroupProfile({ conversationId, title: title || summary.display_name, avatarPath: null });
          await removeGroupAvatarObject(oldPath);
          await load();
        } catch (removeError) {
          setError(removeError instanceof Error ? removeError.message : 'Unable to remove group picture.');
        } finally {
          setIsSaving(false);
        }
      })();
    });
  };

  const addMember = async (user: PublicUserProfile) => {
    if (!conversationId || !canManage) return;
    setBusyMemberId(user.id);
    setError(null);
    try {
      await addGroupMembers(conversationId, [user.id]);
      setAddQuery('');
      setAddResults([]);
      await load();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add this member.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const changeRole = async (member: GroupMember) => {
    if (!conversationId || !isOwner || member.role === 'owner') return;
    setBusyMemberId(member.user_id);
    try {
      await setGroupMemberRole(conversationId, member.user_id, member.role === 'admin' ? 'member' : 'admin');
      await load();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Unable to change this role.');
    } finally {
      setBusyMemberId(null);
    }
  };

  const removeMember = (member: GroupMember) => {
    if (!conversationId) return;
    askConfirmation('Remove member?', `${member.display_name} will lose access to this group.`, 'Remove', () => {
      setBusyMemberId(member.user_id);
      void removeGroupMember(conversationId, member.user_id)
        .then(load)
        .catch((removeError) => setError(removeError instanceof Error ? removeError.message : 'Unable to remove member.'))
        .finally(() => setBusyMemberId(null));
    });
  };

  const transferOwner = (member: GroupMember) => {
    if (!conversationId || !isOwner) return;
    askConfirmation('Transfer ownership?', `${member.display_name} will become owner and you will become an admin.`, 'Transfer', () => {
      setBusyMemberId(member.user_id);
      void transferGroupOwnership(conversationId, member.user_id)
        .then(load)
        .catch((transferError) => setError(transferError instanceof Error ? transferError.message : 'Unable to transfer ownership.'))
        .finally(() => setBusyMemberId(null));
    });
  };

  const leaveGroup = () => {
    if (!conversationId || isOwner) return;
    askConfirmation('Leave group?', 'You will no longer receive messages from this group.', 'Leave', () => {
      void leaveGroupConversation(conversationId)
        .then(() => router.replace('/chats'))
        .catch((leaveError) => setError(leaveError instanceof Error ? leaveError.message : 'Unable to leave group.'));
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerState}><ActivityIndicator size="large" color={theme.colors.primary} /><AppText tone="secondary">Loading group…</AppText></View>
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerState}>
          <EmptyState icon={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }} title="Group unavailable" description={error ?? 'You may no longer be a member.'} />
          <AppButton label="Back to chats" variant="secondary" onPress={() => router.replace('/chats')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.roundButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={24} color={theme.colors.primary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong">Group info</AppText>
          <AppText variant="micro" tone="secondary">{memberCount} members · {summary.my_role}</AppText>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.groupHero}>
          <Pressable disabled={!canManage} onPress={() => void changeAvatar()}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.groupAvatar} /> : <Avatar name={summary.display_name} size={88} />}
            {canManage ? (
              <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary }]}>
                <AppIcon name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={15} color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>
          <AppText variant="title" numberOfLines={2}>{summary.display_name}</AppText>
          <AppText variant="caption" tone="secondary">{memberCount} members</AppText>
        </View>

        {canManage ? (
          <View style={styles.section}>
            <AppText variant="captionStrong" tone="secondary">GROUP DETAILS</AppText>
            <AppTextField label="Group name" value={title} onChangeText={setTitle} maxLength={100} />
            <View style={styles.buttonRow}>
              <View style={styles.flexButton}><AppButton label="Save" loading={isSaving} disabled={!title.trim() || title.trim() === summary.display_name} onPress={() => void saveProfile()} /></View>
              {summary.avatar_path ? <View style={styles.flexButton}><AppButton label="Remove photo" variant="secondary" disabled={isSaving} onPress={removeAvatar} /></View> : null}
            </View>
          </View>
        ) : null}

        {canManage ? (
          <View style={styles.section}>
            <AppText variant="captionStrong" tone="secondary">ADD MEMBER</AppText>
            <SearchBar value={addQuery} onChangeText={setAddQuery} placeholder="Search people" autoCapitalize="none" autoCorrect={false} />
            {isSearching ? <ActivityIndicator color={theme.colors.primary} /> : null}
            {addResults.slice(0, 6).map((person) => (
              <Pressable key={person.id} onPress={() => void addMember(person)} style={[styles.addRow, { borderBottomColor: theme.colors.divider }]}>
                <Avatar name={person.display_name} uri={getAvatarPublicUrl(person.avatar_path)} size={42} />
                <View style={styles.memberCopy}>
                  <AppText variant="bodyStrong">{person.display_name}</AppText>
                  <AppText variant="caption" tone="secondary">{person.username ? `@${person.username}` : 'PulseChat user'}</AppText>
                </View>
                {busyMemberId === person.id ? <ActivityIndicator color={theme.colors.primary} /> : <AppIcon name={{ ios: 'plus.circle.fill', android: 'person_add', web: 'person_add' }} size={24} color={theme.colors.primary} />}
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="captionStrong" tone="secondary">MEMBERS · {members.length}</AppText>
          {members.map((member) => {
            const canRemove = !member.is_self && canManage && member.role !== 'owner' && (isOwner || member.role === 'member');
            const canChangeRole = !member.is_self && isOwner && member.role !== 'owner';
            const canTransfer = !member.is_self && isOwner && member.role !== 'owner';
            return (
              <View key={member.user_id} style={[styles.memberRow, { borderBottomColor: theme.colors.divider }]}>
                <Avatar name={member.display_name} uri={getAvatarPublicUrl(member.avatar_path)} size={46} />
                <View style={styles.memberCopy}>
                  <View style={styles.nameRoleRow}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={styles.memberName}>{member.display_name}{member.is_self ? ' (You)' : ''}</AppText>
                    <RoleBadge role={member.role} />
                  </View>
                  <AppText variant="caption" tone="secondary">{member.username ? `@${member.username}` : 'PulseChat user'}</AppText>
                  {(!member.is_self || canChangeRole || canRemove || canTransfer) ? (
                    <View style={styles.memberActions}>
                      {!member.is_self ? (
                        <Pressable onPress={() => router.push({ pathname: '/users/[userId]', params: { userId: member.user_id } })}>
                          <AppText variant="micro" tone="primary">View profile</AppText>
                        </Pressable>
                      ) : null}
                      {canChangeRole ? (
                        <Pressable disabled={busyMemberId === member.user_id} onPress={() => void changeRole(member)}>
                          <AppText variant="micro" tone="primary">{member.role === 'admin' ? 'Remove admin' : 'Make admin'}</AppText>
                        </Pressable>
                      ) : null}
                      {canTransfer ? (
                        <Pressable disabled={busyMemberId === member.user_id} onPress={() => transferOwner(member)}>
                          <AppText variant="micro" tone="primary">Make owner</AppText>
                        </Pressable>
                      ) : null}
                      {canRemove ? (
                        <Pressable disabled={busyMemberId === member.user_id} onPress={() => removeMember(member)}>
                          <AppText variant="micro" tone="danger">Remove</AppText>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {busyMemberId === member.user_id ? <ActivityIndicator color={theme.colors.primary} /> : null}
              </View>
            );
          })}
        </View>

        {error ? <AppText variant="caption" tone="danger">{error}</AppText> : null}

        {isOwner ? (
          <AppText variant="caption" tone="secondary">Transfer ownership to another member before leaving this group.</AppText>
        ) : (
          <AppButton label="Leave group" variant="danger" onPress={leaveGroup} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  roundButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  content: { padding: 18, paddingBottom: 46, gap: 24 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  groupHero: { alignItems: 'center', gap: 5 },
  groupAvatar: { width: 88, height: 88, borderRadius: 30 },
  cameraBadge: { position: 'absolute', right: -4, bottom: -3, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 10 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  flexButton: { flex: 1 },
  addRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  memberRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  memberCopy: { flex: 1, gap: 3 },
  nameRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { flex: 1 },
  roleBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 4 },
});

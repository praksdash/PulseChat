import type { Database } from '@/types/database';

export type GroupRole = 'member' | 'admin' | 'owner';

export type GroupMember =
  Database['public']['Functions']['list_group_members']['Returns'][number];

export type GroupAvatarSelection = {
  uri: string;
  width: number;
  height: number;
};

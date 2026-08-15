import type { Database } from '@/types/database';

export type PublicUserProfile = Database['public']['Functions']['search_profiles']['Returns'][number];

import { supabase } from '@/lib/supabase';
import type { PublicUserProfile } from '@/types/user-discovery';

const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;

export function normalizeUserSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 50);
}

export async function searchUsers(value: string): Promise<PublicUserProfile[]> {
  const searchTerm = normalizeUserSearchTerm(value);
  if (searchTerm.length < MIN_SEARCH_LENGTH) return [];

  const { data, error } = await supabase.rpc('search_profiles', {
    search_term: searchTerm,
    result_limit: MAX_RESULTS,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PublicUserProfile[];
}

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile | null> {
  if (!userId) return null;

  const { data, error } = await supabase.rpc('get_public_profile', {
    target_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? [])[0] as PublicUserProfile | undefined) ?? null;
}

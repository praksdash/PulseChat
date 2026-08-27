import { supabase } from '@/lib/supabase';

export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: true },
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? 'Unable to delete your PulseChat account.');
}

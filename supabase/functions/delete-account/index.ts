import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function getAdminKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const direct = Deno.env.get('SUPABASE_SECRET_KEY');
  if (direct) return direct;

  const namedSecrets = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (namedSecrets) {
    try {
      const parsed = JSON.parse(namedSecrets) as Record<string, string>;
      const firstSecret = Object.values(parsed).find((value) => typeof value === 'string' && value.length > 0);
      if (firstSecret) return firstSecret;
    } catch {
      // Fall through to the explicit configuration error.
    }
  }

  throw new Error('Supabase server secret is unavailable.');
}

function getPublicKey() {
  return Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? Deno.env.get('SB_PUBLISHABLE_KEY')
    ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publicKey = getPublicKey();
    const authorization = req.headers.get('Authorization');
    if (!supabaseUrl || !publicKey || !authorization) {
      return jsonResponse({ ok: false, error: 'Authentication required.' }, 401);
    }

    const body = await req.json().catch(() => ({})) as { confirm?: boolean };
    if (body.confirm !== true) {
      return jsonResponse({ ok: false, error: 'Explicit deletion confirmation is required.' }, 400);
    }

    const authClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ ok: false, error: 'Authentication required.' }, 401);
    }

    const userId = authData.user.id;
    const admin = createClient(supabaseUrl, getAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Capture ownership before auth deletion cascades remove membership rows.
    const [{ data: ownedRows, error: ownedError }, { data: profile, error: profileError }] = await Promise.all([
      admin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId)
        .eq('role', 'owner'),
      admin
        .from('profiles')
        .select('avatar_path')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    if (ownedError) throw new Error(`Unable to inspect group ownership: ${ownedError.message}`);
    if (profileError) throw new Error(`Unable to inspect profile: ${profileError.message}`);

    const ownedConversationIds = [...new Set((ownedRows ?? []).map((row) => row.conversation_id).filter(Boolean))];
    const { data: ownedGroups, error: ownedGroupsError } = ownedConversationIds.length > 0
      ? await admin
        .from('conversations')
        .select('id, avatar_path')
        .in('id', ownedConversationIds)
        .eq('kind', 'group')
      : { data: [], error: null };
    if (ownedGroupsError) throw new Error(`Unable to inspect owned groups: ${ownedGroupsError.message}`);
    const groupAvatarById = new Map(
      (ownedGroups ?? []).map((group) => [group.id, group.avatar_path as string | null]),
    );

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(`Unable to delete auth account: ${deleteError.message}`);

    // Repair groups whose owner membership was removed by the auth cascade.
    // Prefer an existing admin, then the longest-standing member. If nobody
    // remains, remove the empty group.
    for (const conversationId of ownedConversationIds) {
      const { data: remaining, error: remainingError } = await admin
        .from('conversation_members')
        .select('user_id, role, joined_at')
        .eq('conversation_id', conversationId);
      if (remainingError) {
        console.error('Unable to inspect remaining group members:', conversationId, remainingError.message);
        continue;
      }

      if (!remaining || remaining.length === 0) {
        const { error: deleteGroupError } = await admin
          .from('conversations')
          .delete()
          .eq('id', conversationId)
          .eq('kind', 'group');
        if (deleteGroupError) {
          console.error('Unable to remove empty group:', conversationId, deleteGroupError.message);
        } else {
          const groupAvatarPath = groupAvatarById.get(conversationId);
          if (groupAvatarPath) {
            const { error: groupAvatarError } = await admin.storage
              .from('group-avatars')
              .remove([groupAvatarPath]);
            if (groupAvatarError) {
              console.warn('Empty group removed but avatar cleanup failed:', groupAvatarError.message);
            }
          }
        }
        continue;
      }

      const nextOwner = [...remaining].sort((a, b) => {
        const aRank = a.role === 'admin' ? 0 : 1;
        const bRank = b.role === 'admin' ? 0 : 1;
        if (aRank !== bRank) return aRank - bRank;
        const aTime = new Date(a.joined_at).getTime();
        const bTime = new Date(b.joined_at).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return String(a.user_id).localeCompare(String(b.user_id));
      })[0];

      const { error: ownerError } = await admin
        .from('conversation_members')
        .update({ role: 'owner' })
        .eq('conversation_id', conversationId)
        .eq('user_id', nextOwner.user_id);
      if (ownerError) console.error('Unable to assign replacement group owner:', conversationId, ownerError.message);
    }

    if (profile?.avatar_path) {
      const { error: avatarError } = await admin.storage.from('avatars').remove([profile.avatar_path]);
      if (avatarError) console.warn('Account deleted but avatar cleanup failed:', avatarError.message);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('delete-account failed:', error);
    return jsonResponse({ ok: false, error: 'Account deletion failed.' }, 500);
  }
});

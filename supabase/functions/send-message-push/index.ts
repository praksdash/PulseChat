import { createClient } from 'npm:@supabase/supabase-js@2';

type WebhookMessageRecord = {
  id?: string;
  conversation_id?: string;
  sender_id?: string | null;
  message_type?: string;
  body?: string | null;
  deleted_at?: string | null;
  created_at?: string;
};

type MessageWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: WebhookMessageRecord | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type PushClaimRow = PushTokenRow;

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: {
    type: 'message';
    conversationId: string;
    messageId: string;
    messageType: string;
    conversationKind: 'direct' | 'group';
  };
  badge?: number;
  channelId: 'messages';
  priority: 'high';
};

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const MAX_EXPO_BATCH = 100;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
      // The explicit configuration error below is more useful than leaking JSON details.
    }
  }

  throw new Error('Supabase server secret is unavailable in this Edge Function.');
}

function chunk<T>(values: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

function cleanMessageBody(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}…`;
}

function getNotificationCopy(input: {
  kind: 'direct' | 'group';
  groupTitle: string | null;
  senderName: string;
  messageType: string;
  body: string | null;
}) {
  let preview: string;
  switch (input.messageType) {
    case 'text':
      preview = cleanMessageBody(input.body) ?? 'New message';
      break;
    case 'image': {
      const caption = cleanMessageBody(input.body);
      preview = caption ? `📷 ${caption}` : '📷 Photo';
      break;
    }
    case 'video':
      preview = '🎥 Video';
      break;
    case 'audio':
    case 'voice':
      preview = '🎤 Voice message';
      break;
    case 'file':
      preview = '📎 File';
      break;
    default:
      preview = 'New message';
  }

  if (input.kind === 'group') {
    return {
      title: input.groupTitle?.trim() || 'PulseChat group',
      body: `${input.senderName}: ${preview}`,
    };
  }

  return { title: input.senderName, body: preview };
}

async function dispatchMessage(messageId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is unavailable.');

  const admin = createClient(supabaseUrl, getAdminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!expoAccessToken) {
    throw new Error('EXPO_ACCESS_TOKEN is not configured for the Edge Function.');
  }

  const { data: message, error: messageError } = await admin
    .from('messages')
    .select('id, conversation_id, sender_id, message_type, body, deleted_at, created_at')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError) throw new Error(`Unable to load message: ${messageError.message}`);
  if (!message || message.deleted_at || !message.sender_id) {
    return { sent: 0, skipped: 'missing/deleted/system message' };
  }

  const [{ data: conversation, error: conversationError }, { data: senderProfile, error: senderError }] = await Promise.all([
    admin
      .from('conversations')
      .select('id, kind, title')
      .eq('id', message.conversation_id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('display_name')
      .eq('id', message.sender_id)
      .maybeSingle(),
  ]);

  if (conversationError) throw new Error(`Unable to load conversation: ${conversationError.message}`);
  if (senderError) throw new Error(`Unable to load sender: ${senderError.message}`);
  if (!conversation || (conversation.kind !== 'direct' && conversation.kind !== 'group')) {
    return { sent: 0, skipped: 'conversation unavailable' };
  }

  const { data: memberships, error: membersError } = await admin
    .from('conversation_members')
    .select('user_id, muted_until')
    .eq('conversation_id', message.conversation_id)
    .neq('user_id', message.sender_id);

  if (membersError) throw new Error(`Unable to load recipients: ${membersError.message}`);

  const now = Date.now();
  const recipientIds = (memberships ?? [])
    .filter((member) => {
      if (!member.muted_until) return true;
      const until = new Date(member.muted_until).getTime();
      return Number.isNaN(until) || until <= now;
    })
    .map((member) => member.user_id);

  if (recipientIds.length === 0) return { sent: 0, skipped: 'no recipients' };

  const [{ data: tokens, error: tokensError }, { data: unreadRows, error: unreadError }] = await Promise.all([
    admin
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', recipientIds)
      .eq('enabled', true),
    admin.rpc('get_push_unread_counts', { target_user_ids: recipientIds }),
  ]);

  if (tokensError) throw new Error(`Unable to load push tokens: ${tokensError.message}`);
  if (unreadError) throw new Error(`Unable to load unread counts: ${unreadError.message}`);
  if (!tokens || tokens.length === 0) return { sent: 0, skipped: 'no registered tokens' };

  const requestedClaims = (tokens as PushTokenRow[]).map((token) => ({
    user_id: token.user_id,
    expo_push_token: token.expo_push_token,
  }));

  const { data: claims, error: claimError } = await admin.rpc('claim_push_deliveries', {
    target_message_id: message.id,
    target_deliveries: requestedClaims,
  });

  if (claimError) throw new Error(`Unable to claim push deliveries: ${claimError.message}`);
  const claimed = (claims ?? []) as PushClaimRow[];
  if (claimed.length === 0) return { sent: 0, skipped: 'already dispatched' };

  const unreadByUser = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    if (row?.user_id && typeof row.unread_count === 'number') {
      unreadByUser.set(row.user_id, Math.max(0, Math.trunc(row.unread_count)));
    }
  }

  const copy = getNotificationCopy({
    kind: conversation.kind,
    groupTitle: conversation.title,
    senderName: senderProfile?.display_name?.trim() || 'PulseChat User',
    messageType: message.message_type,
    body: message.body,
  });

  const notificationByToken = new Map<string, ExpoPushMessage>();
  for (const claim of claimed) {
    const unreadCount = unreadByUser.get(claim.user_id) ?? 0;
    notificationByToken.set(claim.expo_push_token, {
      to: claim.expo_push_token,
      sound: 'default',
      title: copy.title,
      body: copy.body,
      data: {
        type: 'message',
        conversationId: message.conversation_id,
        messageId: message.id,
        messageType: message.message_type,
        conversationKind: conversation.kind,
      },
      ...(unreadCount > 0 ? { badge: unreadCount } : {}),
      channelId: 'messages',
      priority: 'high',
    });
  }

  let sentCount = 0;
  let errorCount = 0;
  const invalidTokens = new Set<string>();

  for (const claimBatch of chunk(claimed, MAX_EXPO_BATCH)) {
    const pushBatch = claimBatch
      .map((claim) => notificationByToken.get(claim.expo_push_token))
      .filter((value): value is ExpoPushMessage => Boolean(value));

    if (pushBatch.length === 0) continue;

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Authorization: `Bearer ${expoAccessToken}`,
        },
        body: JSON.stringify(pushBatch),
      });

      if (!response.ok) {
        const responseText = (await response.text()).slice(0, 500);
        throw new Error(`Expo Push Service HTTP ${response.status}: ${responseText}`);
      }

      const result = await response.json() as { data?: ExpoPushTicket[] };
      const tickets = Array.isArray(result.data) ? result.data : [];
      const updates = claimBatch.map((claim, index) => {
        const ticket = tickets[index];
        const ok = ticket?.status === 'ok';
        if (ticket?.details?.error === 'DeviceNotRegistered') invalidTokens.add(claim.expo_push_token);
        if (ok) sentCount += 1;
        else errorCount += 1;

        return {
          message_id: message.id,
          user_id: claim.user_id,
          expo_push_token: claim.expo_push_token,
          status: ok ? 'sent' : 'error',
          ticket_id: ticket?.id ?? null,
          error_code: ticket?.details?.error ?? (ticket ? 'EXPO_TICKET_ERROR' : 'MISSING_TICKET'),
          error_message: ticket?.message?.slice(0, 500) ?? (ticket ? null : 'Expo Push Service returned no ticket.'),
          updated_at: new Date().toISOString(),
        };
      });

      const { error: logError } = await admin
        .from('push_delivery_log')
        .upsert(updates, { onConflict: 'message_id,expo_push_token' });
      if (logError) console.error('Unable to update push delivery log:', logError.message);
    } catch (error) {
      errorCount += claimBatch.length;
      const errorMessage = error instanceof Error ? error.message.slice(0, 500) : 'Push delivery request failed.';
      const failedUpdates = claimBatch.map((claim) => ({
        message_id: message.id,
        user_id: claim.user_id,
        expo_push_token: claim.expo_push_token,
        status: 'error',
        ticket_id: null,
        error_code: 'PUSH_REQUEST_FAILED',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      }));
      const { error: logError } = await admin
        .from('push_delivery_log')
        .upsert(failedUpdates, { onConflict: 'message_id,expo_push_token' });
      if (logError) console.error('Unable to record failed push request:', logError.message);
    }
  }

  if (invalidTokens.size > 0) {
    const { error: disableError } = await admin
      .from('push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .in('expo_push_token', [...invalidTokens]);
    if (disableError) console.error('Unable to disable invalid push token:', disableError.message);
  }

  return { sent: sentCount, errors: errorCount, claimed: claimed.length };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  const suppliedSecret = req.headers.get('x-pulsechat-webhook-secret');
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized webhook.' }, 401);
  }

  let payload: MessageWebhookPayload;
  try {
    payload = await req.json() as MessageWebhookPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  if (
    payload.type !== 'INSERT'
    || payload.schema !== 'public'
    || payload.table !== 'messages'
    || !payload.record?.id
  ) {
    return jsonResponse({ ok: true, ignored: true });
  }

  try {
    const result = await dispatchMessage(payload.record.id);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error('PulseChat push dispatch failed:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Push dispatch failed.',
    }, 500);
  }
});

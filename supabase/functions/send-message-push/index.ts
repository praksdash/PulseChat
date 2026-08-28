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
  action?: string;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type PushClaimRow = PushTokenRow;

type NotificationPreferenceRow = {
  user_id: string;
  direct_messages: boolean;
  group_messages: boolean;
  show_message_preview: boolean;
};


type ExpoPushTicket = {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushMessage = {
  to: string;
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  channelId?: 'messages';
  priority?: 'high';
};

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const MAX_EXPO_BATCH = 100;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pulsechat-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function secretsMatch(expected: string, supplied: string) {
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expected);
  const suppliedBytes = encoder.encode(supplied);
  let difference = expectedBytes.length ^ suppliedBytes.length;
  const maxLength = Math.max(expectedBytes.length, suppliedBytes.length);
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (expectedBytes[index] ?? 0) ^ (suppliedBytes[index] ?? 0);
  }
  return difference === 0;
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
      // Fall through to explicit configuration error.
    }
  }

  throw new Error('Supabase server secret is unavailable in this Edge Function.');
}

function getPublicKey() {
  return Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? Deno.env.get('SB_PUBLISHABLE_KEY')
    ?? null;
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

async function postExpoMessages(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return [] as ExpoPushTicket[];

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

  const allTickets: ExpoPushTicket[] = [];
  for (const batch of chunk(messages, MAX_EXPO_BATCH)) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 500);
      throw new Error(`Expo Push Service HTTP ${response.status}: ${responseText}`);
    }

    const result = await response.json() as { data?: ExpoPushTicket[] };
    const tickets = Array.isArray(result.data) ? result.data : [];
    while (tickets.length < batch.length) {
      tickets.push({ status: 'error', message: 'Expo Push Service returned no ticket.', details: { error: 'MISSING_TICKET' } });
    }
    allTickets.push(...tickets.slice(0, batch.length));
  }

  return allTickets;
}

async function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is unavailable.');
  return createClient(supabaseUrl, getAdminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function dispatchTestForAuthenticatedUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publicKey = getPublicKey();
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !publicKey || !authorization) {
    return jsonResponse({ ok: false, error: 'Authenticated test request is missing credentials.' }, 401);
  }

  const authClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    return jsonResponse({ ok: false, error: 'Authentication required for a test notification.' }, 401);
  }

  const { error: rateLimitError } = await authClient.rpc('claim_my_push_test');
  if (rateLimitError) {
    const limited = rateLimitError.message.toLowerCase().includes('too many requests');
    return jsonResponse({
      ok: false,
      error: limited ? 'Too many test notifications. Try again later.' : 'Unable to authorize the test notification.',
    }, limited ? 429 : 403);
  }

  const admin = await getAdminClient();
  const { data: tokens, error: tokenError } = await admin
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', user.id)
    .eq('enabled', true);

  if (tokenError) throw new Error(`Unable to load your push token: ${tokenError.message}`);
  if (!tokens || tokens.length === 0) {
    return jsonResponse({ ok: false, sent: 0, errors: 0, error: 'No enabled Expo push token is registered for this account.' }, 400);
  }

  const messages: ExpoPushMessage[] = tokens.map((row) => ({
    to: row.expo_push_token,
    sound: 'default',
    title: 'PulseChat test',
    body: 'Remote push is configured correctly for this device.',
    data: { type: 'test' },
    channelId: 'messages',
    priority: 'high',
  }));

  const tickets = await postExpoMessages(messages);
  let sent = 0;
  let errors = 0;
  const details: string[] = [];
  const invalidTokens: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status === 'ok') {
      sent += 1;
      return;
    }
    errors += 1;
    const code = ticket.details?.error ?? 'EXPO_TICKET_ERROR';
    details.push(`${code}: ${ticket.message ?? 'Push rejected.'}`);
    if (code === 'DeviceNotRegistered') invalidTokens.push(tokens[index].expo_push_token);
  });

  if (invalidTokens.length > 0) {
    await admin
      .from('push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .in('expo_push_token', invalidTokens);
  }

  return jsonResponse({ ok: errors === 0, sent, errors, details });
}

async function dispatchMessage(messageId: string) {
  const admin = await getAdminClient();

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
  let recipientIds = (memberships ?? [])
    .filter((member) => {
      if (!member.muted_until) return true;
      const until = new Date(member.muted_until).getTime();
      return Number.isNaN(until) || until <= now;
    })
    .map((member) => member.user_id);

  if (recipientIds.length === 0) return { sent: 0, skipped: 'no recipients' };

  // Phase 17 defense in depth: a direct block in either direction suppresses
  // push even if the message was committed immediately before the block.
  if (conversation.kind === 'direct') {
    const [blockedBySenderResult, blockedSenderResult] = await Promise.all([
      admin
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('blocker_id', message.sender_id)
        .in('blocked_user_id', recipientIds),
      admin
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_user_id', message.sender_id)
        .in('blocker_id', recipientIds),
    ]);

    if (blockedBySenderResult.error) {
      throw new Error(`Unable to check sender blocks: ${blockedBySenderResult.error.message}`);
    }
    if (blockedSenderResult.error) {
      throw new Error(`Unable to check recipient blocks: ${blockedSenderResult.error.message}`);
    }

    const blockedRecipients = new Set<string>();
    for (const row of blockedBySenderResult.data ?? []) {
      if (row.blocked_user_id) blockedRecipients.add(row.blocked_user_id);
    }
    for (const row of blockedSenderResult.data ?? []) {
      if (row.blocker_id) blockedRecipients.add(row.blocker_id);
    }
    recipientIds = recipientIds.filter((userId) => !blockedRecipients.has(userId));
    if (recipientIds.length === 0) return { sent: 0, skipped: 'blocked direct relationship' };
  }

  const { data: preferenceRows, error: preferenceError } = await admin
    .from('notification_preferences')
    .select('user_id, direct_messages, group_messages, show_message_preview')
    .in('user_id', recipientIds);

  if (preferenceError) throw new Error(`Unable to load notification preferences: ${preferenceError.message}`);

  const preferencesByUser = new Map<string, NotificationPreferenceRow>();
  for (const row of (preferenceRows ?? []) as NotificationPreferenceRow[]) {
    preferencesByUser.set(row.user_id, row);
  }

  recipientIds = recipientIds.filter((userId) => {
    const preference = preferencesByUser.get(userId);
    if (!preference) return true; // Default-on for accounts created before Phase 18.
    return conversation.kind === 'direct' ? preference.direct_messages : preference.group_messages;
  });
  if (recipientIds.length === 0) return { sent: 0, skipped: 'disabled by notification preferences' };

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
  if (claimed.length === 0) return { sent: 0, skipped: 'already dispatched or already read' };

  const unreadByUser = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    if (row?.user_id && typeof row.unread_count === 'number') {
      unreadByUser.set(row.user_id, Math.max(0, Math.trunc(row.unread_count)));
    }
  }

  const previewCopy = getNotificationCopy({
    kind: conversation.kind,
    groupTitle: conversation.title,
    senderName: senderProfile?.display_name?.trim() || 'PulseChat User',
    messageType: message.message_type,
    body: message.body,
  });

  const notificationByToken = new Map<string, ExpoPushMessage>();
  for (const claim of claimed) {
    const unreadCount = unreadByUser.get(claim.user_id) ?? 0;
    const preference = preferencesByUser.get(claim.user_id);
    const showPreview = preference?.show_message_preview ?? true;
    const copy = showPreview
      ? previewCopy
      : { title: 'PulseChat', body: conversation.kind === 'group' ? 'New group message' : 'New message' };
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
      const tickets = await postExpoMessages(pushBatch);
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  let payload: MessageWebhookPayload;
  try {
    payload = await req.json() as MessageWebhookPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  try {
    if (payload.action === 'test') {
      return await dispatchTestForAuthenticatedUser(req);
    }

    const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    const suppliedSecret = req.headers.get('x-pulsechat-webhook-secret');
    if (!expectedSecret || !suppliedSecret || !secretsMatch(expectedSecret, suppliedSecret)) {
      return jsonResponse({ error: 'Unauthorized webhook.' }, 401);
    }

    if (
      payload.type !== 'INSERT'
      || payload.schema !== 'public'
      || payload.table !== 'messages'
      || !payload.record?.id
    ) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const result = await dispatchMessage(payload.record.id);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error('PulseChat push dispatch failed:', error);
    return jsonResponse({ ok: false, error: 'Push dispatch failed.' }, 500);
  }
});

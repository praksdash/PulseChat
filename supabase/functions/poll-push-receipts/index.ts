import { createClient } from 'npm:@supabase/supabase-js@2';

type DeliveryRow = {
  id: number;
  message_id: string;
  user_id: string;
  expo_push_token: string;
  status: 'ticketed';
  ticket_id: string;
  error_code: string | null;
  error_message: string | null;
  receipt_attempt_count: number;
  last_receipt_check_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

type ExpoReceipt = {
  status?: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

const EXPO_RECEIPT_ENDPOINT = 'https://exp.host/--/api/v2/push/getReceipts';
const RECEIPT_READY_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_RECEIPTS_PER_RUN = 1_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
      // Fall through to a controlled configuration error.
    }
  }
  throw new Error('Supabase server secret is unavailable.');
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is unavailable.');
  return createClient(supabaseUrl, getAdminKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchReceipts(ticketIds: string[]) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

  const response = await fetch(EXPO_RECEIPT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: ticketIds }),
  });
  if (!response.ok) throw new Error(`Expo receipt service returned HTTP ${response.status}.`);
  const result = await response.json() as { data?: Record<string, ExpoReceipt> };
  return result.data ?? {};
}

async function recordJobFailure(admin: ReturnType<typeof getAdminClient>, startedAt: string) {
  await admin.from('operational_jobs').upsert({
    job_key: 'push_receipt_poll',
    status: 'error',
    last_started_at: startedAt,
    last_failed_at: new Date().toISOString(),
    processed_count: 0,
    error_code: 'RECEIPT_POLL_FAILED',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'job_key' });
}

async function pollReceipts() {
  const admin = getAdminClient();
  const startedAt = new Date().toISOString();
  await admin.from('operational_jobs').upsert({
    job_key: 'push_receipt_poll',
    status: 'running',
    last_started_at: startedAt,
    processed_count: 0,
    error_code: null,
    updated_at: startedAt,
  }, { onConflict: 'job_key' });

  try {
    const readyBefore = new Date(Date.now() - RECEIPT_READY_DELAY_MS).toISOString();
    const { data, error } = await admin
      .from('push_delivery_log')
      .select('id, message_id, user_id, expo_push_token, status, ticket_id, error_code, error_message, receipt_attempt_count, last_receipt_check_at, delivered_at, created_at, updated_at')
      .eq('status', 'ticketed')
      .not('ticket_id', 'is', null)
      .lte('updated_at', readyBefore)
      .order('updated_at', { ascending: true })
      .limit(MAX_RECEIPTS_PER_RUN);
    if (error) throw new Error('Unable to load pending push receipts.');

    const rows = (data ?? []) as DeliveryRow[];
    if (rows.length === 0) {
      await admin.from('operational_jobs').upsert({
        job_key: 'push_receipt_poll',
        status: 'ok',
        last_started_at: startedAt,
        last_succeeded_at: new Date().toISOString(),
        processed_count: 0,
        error_code: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'job_key' });
      const { error: maintenanceError } = await admin.rpc('run_operational_maintenance');
      if (maintenanceError) throw new Error('Operational maintenance failed.');
      return { checked: 0, delivered: 0, errors: 0, pending: 0, disabledTokens: 0 };
    }

    const receipts = await fetchReceipts(rows.map((row) => row.ticket_id));
    const checkedAt = new Date().toISOString();
    let delivered = 0;
    let errors = 0;
    let pending = 0;
    const invalidTokens = new Set<string>();

    const updates = rows.map((row) => {
      const receipt = receipts[row.ticket_id];
      const nextAttemptCount = Math.min(20, row.receipt_attempt_count + 1);
      const expired = Date.now() - new Date(row.created_at).getTime() >= RECEIPT_ABANDON_AFTER_MS;
      let status: 'ticketed' | 'delivered' | 'error' = 'ticketed';
      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      let deliveredAt: string | null = null;

      if (receipt?.status === 'ok') {
        status = 'delivered';
        deliveredAt = checkedAt;
        delivered += 1;
      } else if (receipt?.status === 'error') {
        status = 'error';
        errorCode = receipt.details?.error?.slice(0, 64) || 'EXPO_RECEIPT_ERROR';
        errorMessage = receipt.message?.slice(0, 500) || 'Expo reported a delivery error.';
        errors += 1;
        if (errorCode === 'DeviceNotRegistered') invalidTokens.add(row.expo_push_token);
      } else if (expired || nextAttemptCount >= 10) {
        status = 'error';
        errorCode = 'RECEIPT_UNAVAILABLE';
        errorMessage = 'Expo did not return a receipt within the bounded polling window.';
        errors += 1;
      } else {
        pending += 1;
      }

      return {
        ...row,
        status,
        error_code: errorCode,
        error_message: errorMessage,
        receipt_attempt_count: nextAttemptCount,
        last_receipt_check_at: checkedAt,
        delivered_at: deliveredAt,
        updated_at: checkedAt,
      };
    });

    const { error: updateError } = await admin
      .from('push_delivery_log')
      .upsert(updates, { onConflict: 'message_id,expo_push_token' });
    if (updateError) throw new Error('Unable to persist push receipt outcomes.');

    if (invalidTokens.size > 0) {
      const { error: disableError } = await admin
        .from('push_tokens')
        .update({ enabled: false, updated_at: checkedAt })
        .in('expo_push_token', [...invalidTokens]);
      if (disableError) throw new Error('Unable to disable invalid push tokens.');
    }

    await admin.from('operational_jobs').upsert({
      job_key: 'push_receipt_poll',
      status: 'ok',
      last_started_at: startedAt,
      last_succeeded_at: checkedAt,
      processed_count: rows.length,
      error_code: null,
      updated_at: checkedAt,
    }, { onConflict: 'job_key' });

    const { error: maintenanceError } = await admin.rpc('run_operational_maintenance');
    if (maintenanceError) throw new Error('Operational maintenance failed.');

    return {
      checked: rows.length,
      delivered,
      errors,
      pending,
      disabledTokens: invalidTokens.size,
    };
  } catch (error) {
    await recordJobFailure(admin, startedAt);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const expectedSecret = Deno.env.get('PUSH_RECEIPT_SECRET');
  const suppliedSecret = req.headers.get('x-pulsechat-receipt-secret');
  if (!expectedSecret || !suppliedSecret || !secretsMatch(expectedSecret, suppliedSecret)) {
    return jsonResponse({ error: 'Unauthorized receipt poll.' }, 401);
  }

  try {
    return jsonResponse({ ok: true, ...await pollReceipts() });
  } catch (error) {
    console.error('PulseChat receipt poll failed:', error);
    return jsonResponse({ ok: false, error: 'Push receipt polling failed.' }, 500);
  }
});

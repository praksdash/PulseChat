import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

import {
  callRoomName,
  createLiveKitJoinToken,
  normalizeCallSessionId,
} from '../_shared/livekit-token.mjs';

type CallSessionRow = {
  id: string;
  caller_user_id: string;
  callee_user_id: string;
  call_type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'active' | 'declined' | 'cancelled' | 'missed' | 'ended' | 'failed';
  ring_expires_at: string;
};

const TOKEN_TTL_SECONDS = 120;
const MAX_REQUEST_CHARACTERS = 2048;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const RESPONSE_HEADERS = {
  ...CORS_HEADERS,
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
}

function getPublicKey() {
  return Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? Deno.env.get('SB_PUBLISHABLE_KEY')
    ?? null;
}

function getLiveKitConfiguration() {
  const serverUrl = Deno.env.get('LIVEKIT_URL')?.trim();
  const apiKey = Deno.env.get('LIVEKIT_API_KEY')?.trim();
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')?.trim();

  if (!serverUrl || !apiKey || !apiSecret || apiSecret.length < 32) {
    return null;
  }

  try {
    const parsedUrl = new URL(serverUrl);
    if (parsedUrl.protocol !== 'wss:') return null;
    return {
      serverUrl: parsedUrl.toString().replace(/\/$/u, ''),
      apiKey,
      apiSecret,
    };
  } catch {
    return null;
  }
}

function callIsJoinableBy(row: CallSessionRow, userId: string, nowMilliseconds: number) {
  const isCaller = row.caller_user_id === userId;
  const isCallee = row.callee_user_id === userId;
  if (!isCaller && !isCallee) return false;

  if (row.status === 'ringing') {
    return isCaller && Date.parse(row.ring_expires_at) > nowMilliseconds;
  }

  return row.status === 'accepted' || row.status === 'active';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publicKey = getPublicKey();
    const authorization = request.headers.get('Authorization');
    if (!supabaseUrl || !publicKey || !authorization?.startsWith('Bearer ')) {
      return jsonResponse({ ok: false, error: 'Authentication required.' }, 401);
    }

    const rawBody = await request.text();
    if (rawBody.length === 0 || rawBody.length > MAX_REQUEST_CHARACTERS) {
      return jsonResponse({ ok: false, error: 'Invalid request.' }, 400);
    }

    let callSessionId: string;
    try {
      const body = JSON.parse(rawBody) as { callSessionId?: unknown };
      callSessionId = normalizeCallSessionId(body.callSessionId);
    } catch {
      return jsonResponse({ ok: false, error: 'A valid call session is required.' }, 400);
    }

    const authClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData.user;
    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Authentication required.' }, 401);
    }

    // This query intentionally uses the caller's bearer token and the Phase
    // 27.2 RLS policy. No service-role client participates in token issuance.
    const { data, error: callError } = await authClient
      .from('call_sessions')
      .select('id, caller_user_id, callee_user_id, call_type, status, ring_expires_at')
      .eq('id', callSessionId)
      .maybeSingle();

    if (callError) {
      return jsonResponse({ ok: false, error: 'Call authorization is temporarily unavailable.' }, 503);
    }
    if (!data) {
      // A missing row and an RLS-hidden row intentionally have the same result.
      return jsonResponse({ ok: false, error: 'Call session not found.' }, 404);
    }

    const call = data as CallSessionRow;
    const nowMilliseconds = Date.now();
    if (!callIsJoinableBy(call, user.id, nowMilliseconds)) {
      return jsonResponse({ ok: false, error: 'Call is not joinable.' }, 409);
    }

    const liveKit = getLiveKitConfiguration();
    if (!liveKit) {
      return jsonResponse({ ok: false, error: 'Calling service is not configured.' }, 503);
    }

    const issuedAt = Math.floor(nowMilliseconds / 1000);
    const token = await createLiveKitJoinToken({
      apiKey: liveKit.apiKey,
      apiSecret: liveKit.apiSecret,
      participantIdentity: user.id,
      callSessionId: call.id,
      callType: call.call_type,
      nowSeconds: issuedAt,
      ttlSeconds: TOKEN_TTL_SECONDS,
    });

    return jsonResponse({
      ok: true,
      callSessionId: call.id,
      roomName: callRoomName(call.id),
      serverUrl: liveKit.serverUrl,
      token,
      expiresAt: new Date((issuedAt + TOKEN_TTL_SECONDS) * 1000).toISOString(),
    });
  } catch {
    // Never return database details, bearer tokens, provider credentials, or
    // signing failures to the client.
    console.error('issue-call-token failed safely');
    return jsonResponse({ ok: false, error: 'Unable to issue a call token.' }, 500);
  }
});


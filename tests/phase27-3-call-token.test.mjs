import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  callRoomName,
  createLiveKitJoinToken,
} from '../supabase/functions/_shared/livekit-token.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const callId = '927389ec-de01-40c9-8eaf-a33f67161ab8';
const userId = 'dfb6f969-8554-4053-8400-fce1301c9180';
const secret = 'test-only-livekit-secret-32-characters-minimum';

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

async function verifyHmac(token, signingSecret) {
  const [header, payload, signature] = token.split('.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
}

test('Phase 27.3 creates a short-lived room-scoped HS256 token', async () => {
  const token = await createLiveKitJoinToken({
    apiKey: 'test-api-key',
    apiSecret: secret,
    participantIdentity: userId,
    callSessionId: callId,
    callType: 'voice',
    nowSeconds: 1_788_048_000,
    ttlSeconds: 120,
    tokenId: 'test-token-id-0001',
  });

  const [encodedHeader, encodedPayload] = token.split('.');
  const header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8'));
  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8'));

  assert.deepEqual(header, { alg: 'HS256', typ: 'JWT' });
  assert.equal(payload.iss, 'test-api-key');
  assert.equal(payload.sub, userId);
  assert.equal(payload.exp - payload.iat, 120);
  assert.equal(payload.video.room, callRoomName(callId));
  assert.equal(payload.video.roomJoin, true);
  assert.deepEqual(payload.video.canPublishSources, ['microphone']);
  assert.equal(payload.video.canPublishData, false);
  assert.equal(await verifyHmac(token, secret), true);
});

test('Phase 27.3 video grants only microphone and camera publication', async () => {
  const token = await createLiveKitJoinToken({
    apiKey: 'test-api-key',
    apiSecret: secret,
    participantIdentity: userId,
    callSessionId: callId,
    callType: 'video',
    nowSeconds: 1_788_048_000,
    tokenId: 'test-token-id-0002',
  });
  const payload = JSON.parse(decodeBase64Url(token.split('.')[1]).toString('utf8'));
  assert.deepEqual(payload.video.canPublishSources, ['microphone', 'camera']);
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(secret));
});

test('Phase 27.3 rejects invalid call ids and long-lived token requests', async () => {
  await assert.rejects(
    createLiveKitJoinToken({
      apiKey: 'test-api-key',
      apiSecret: secret,
      participantIdentity: userId,
      callSessionId: '../another-room',
      callType: 'voice',
    }),
    /callSessionId/,
  );
  await assert.rejects(
    createLiveKitJoinToken({
      apiKey: 'test-api-key',
      apiSecret: secret,
      participantIdentity: userId,
      callSessionId: callId,
      callType: 'voice',
      ttlSeconds: 3600,
    }),
    /ttlSeconds/,
  );
});

test('Phase 27.3 endpoint authenticates and authorizes through caller RLS', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'supabase/functions/issue-call-token/index.ts'),
    'utf8',
  );
  assert.match(source, /authClient\.auth\.getUser\(\)/);
  assert.match(source, /authClient[\s\S]+\.from\('call_sessions'\)/);
  assert.match(source, /No service-role client participates in token issuance/);
  assert.match(source, /isCaller && Date\.parse\(row\.ring_expires_at\) > nowMilliseconds/);
  assert.match(source, /row\.status === 'accepted' \|\| row\.status === 'active'/);
  assert.match(source, /'Cache-Control': 'no-store'/);
});

test('Phase 27.3 keeps provider credentials server-side and pinned', () => {
  const source = fs.readFileSync(
    path.join(projectRoot, 'supabase/functions/issue-call-token/index.ts'),
    'utf8',
  );
  const config = fs.readFileSync(
    path.join(projectRoot, 'supabase/config.toml'),
    'utf8',
  );
  assert.match(source, /npm:@supabase\/supabase-js@2\.111\.0/);
  assert.match(source, /Deno\.env\.get\('LIVEKIT_API_SECRET'\)/);
  assert.doesNotMatch(source, /EXPO_PUBLIC_LIVEKIT/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(config, /\[functions\.issue-call-token\][\s\S]+verify_jwt = false/);
});


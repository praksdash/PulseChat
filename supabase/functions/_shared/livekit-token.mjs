const encoder = new TextEncoder();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function textToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function requireBoundedString(value, name, minimum, maximum) {
  if (typeof value !== 'string') throw new TypeError(`${name} is required.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new TypeError(`${name} has an invalid length.`);
  }
  return normalized;
}

export function normalizeCallSessionId(value) {
  const normalized = requireBoundedString(value, 'callSessionId', 36, 36).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new TypeError('callSessionId must be a UUID.');
  return normalized;
}

export function callRoomName(callSessionId) {
  return `pulsechat-call-${normalizeCallSessionId(callSessionId)}`;
}

export async function createLiveKitJoinToken({
  apiKey,
  apiSecret,
  participantIdentity,
  callSessionId,
  callType,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 120,
  tokenId = crypto.randomUUID(),
}) {
  const issuer = requireBoundedString(apiKey, 'apiKey', 3, 256);
  const secret = requireBoundedString(apiSecret, 'apiSecret', 32, 512);
  const identity = requireBoundedString(participantIdentity, 'participantIdentity', 36, 128);
  const normalizedCallId = normalizeCallSessionId(callSessionId);
  const normalizedTokenId = requireBoundedString(tokenId, 'tokenId', 8, 128);

  if (!Number.isSafeInteger(nowSeconds) || nowSeconds <= 0) {
    throw new TypeError('nowSeconds must be a positive integer.');
  }
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 300) {
    throw new TypeError('ttlSeconds must be between 30 and 300 seconds.');
  }
  if (callType !== 'voice' && callType !== 'video') {
    throw new TypeError('callType must be voice or video.');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: issuer,
    sub: identity,
    iat: nowSeconds,
    nbf: nowSeconds - 5,
    exp: nowSeconds + ttlSeconds,
    jti: normalizedTokenId,
    video: {
      room: callRoomName(normalizedCallId),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: callType === 'video'
        ? ['microphone', 'camera']
        : ['microphone'],
    },
  };

  const unsignedToken = [header, payload]
    .map((part) => textToBase64Url(JSON.stringify(part)))
    .join('.');
  const signingKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    signingKey,
    encoder.encode(unsignedToken),
  );

  return `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`;
}


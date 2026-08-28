const { gcm } = require('@noble/ciphers/aes');
const {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} = require('@noble/ciphers/utils');

const ENVELOPE_VERSION = 2;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;

function assertKey(key) {
  if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) {
    throw new Error('Secure envelopes require a 256-bit key.');
  }
}

function randomNonce() {
  const nonce = new Uint8Array(NONCE_BYTES);
  globalThis.crypto.getRandomValues(nonce);
  return nonce;
}

function encryptAuthenticatedString(key, value, associatedData) {
  assertKey(key);
  const nonce = randomNonce();
  const aad = utf8ToBytes(associatedData);
  const encrypted = gcm(key, nonce, aad).encrypt(utf8ToBytes(value));

  return JSON.stringify({
    v: ENVELOPE_VERSION,
    nonce: bytesToHex(nonce),
    cipher: bytesToHex(encrypted),
  });
}

function decryptAuthenticatedString(key, serializedEnvelope, associatedData) {
  assertKey(key);

  const envelope = JSON.parse(serializedEnvelope);
  if (
    envelope?.v !== ENVELOPE_VERSION
    || typeof envelope.nonce !== 'string'
    || typeof envelope.cipher !== 'string'
  ) {
    throw new Error('Unsupported secure envelope.');
  }

  const nonce = hexToBytes(envelope.nonce);
  if (nonce.length !== NONCE_BYTES) throw new Error('Invalid secure-envelope nonce.');

  const decrypted = gcm(key, nonce, utf8ToBytes(associatedData))
    .decrypt(hexToBytes(envelope.cipher));
  return bytesToUtf8(decrypted);
}

module.exports = {
  decryptAuthenticatedString,
  encryptAuthenticatedString,
};

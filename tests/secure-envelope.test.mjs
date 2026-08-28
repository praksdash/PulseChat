import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  decryptAuthenticatedString,
  encryptAuthenticatedString,
} = require('../src/utils/secure-envelope.js');

function key() {
  return Uint8Array.from({ length: 32 }, (_, index) => index + 1);
}

test('secure envelope round-trips Unicode text', () => {
  const encrypted = encryptAuthenticatedString(key(), 'PulseChat 🔐 message', 'cache:user:chat');
  assert.notEqual(encrypted, 'PulseChat 🔐 message');
  assert.equal(
    decryptAuthenticatedString(key(), encrypted, 'cache:user:chat'),
    'PulseChat 🔐 message',
  );
});

test('secure envelope rejects ciphertext tampering', () => {
  const encrypted = encryptAuthenticatedString(key(), 'private', 'outbox:user');
  const envelope = JSON.parse(encrypted);
  envelope.cipher = `${envelope.cipher.slice(0, -2)}${envelope.cipher.endsWith('00') ? '01' : '00'}`;

  assert.throws(
    () => decryptAuthenticatedString(key(), JSON.stringify(envelope), 'outbox:user'),
    /invalid.*tag/i,
  );
});

test('secure envelope binds ciphertext to its storage key', () => {
  const encrypted = encryptAuthenticatedString(key(), 'private', 'cache:user-a');
  assert.throws(
    () => decryptAuthenticatedString(key(), encrypted, 'cache:user-b'),
    /invalid.*tag/i,
  );
});

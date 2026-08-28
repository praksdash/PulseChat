import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  decryptAuthenticatedString,
  encryptAuthenticatedString,
} from '@/utils/secure-envelope';

const MASTER_KEY_NAME = 'pulsechat_offline_vault_key_v1';
const LEGACY_ENVELOPE_VERSION = 1;
const browserMemoryVault = new Map<string, string>();

type EncryptedEnvelope = {
  v: number;
  counter: number;
  cipher: string;
};

let masterKeyPromise: Promise<Uint8Array> | null = null;

async function getMasterKey() {
  if (masterKeyPromise) return masterKeyPromise;

  masterKeyPromise = (async () => {
    const stored = await SecureStore.getItemAsync(MASTER_KEY_NAME);
    if (stored) return aesjs.utils.hex.toBytes(stored);

    const generated = crypto.getRandomValues(new Uint8Array(32));
    await SecureStore.setItemAsync(MASTER_KEY_NAME, aesjs.utils.hex.fromBytes(generated));
    return generated;
  })();

  return masterKeyPromise;
}

export async function localVaultSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    // Browser storage is readable by any script executing in the origin. Keep
    // message snapshots/outbox entries memory-only and erase Phase 19 plaintext
    // values as each key is touched.
    browserMemoryVault.set(key, value);
    await AsyncStorage.removeItem(key);
    return;
  }

  const masterKey = await getMasterKey();
  await AsyncStorage.setItem(key, encryptAuthenticatedString(masterKey, value, key));
}

export async function localVaultGet(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return browserMemoryVault.get(key) ?? null;
  }

  const stored = await AsyncStorage.getItem(key);
  if (!stored) return stored;

  try {
    const parsed = JSON.parse(stored) as EncryptedEnvelope;
    const masterKey = await getMasterKey();

    if (parsed?.v === 2) {
      return decryptAuthenticatedString(masterKey, stored, key);
    }

    // One-time compatibility for native Phase 19 AES-CTR values. A successful
    // read is immediately rewritten as an authenticated AES-256-GCM envelope.
    if (
      parsed?.v === LEGACY_ENVELOPE_VERSION
      && typeof parsed.counter === 'number'
      && typeof parsed.cipher === 'string'
    ) {
      const legacyCipher = new aesjs.ModeOfOperation.ctr(masterKey, new aesjs.Counter(parsed.counter));
      const decrypted = aesjs.utils.utf8.fromBytes(
        legacyCipher.decrypt(aesjs.utils.hex.toBytes(parsed.cipher)),
      );
      await localVaultSet(key, decrypted);
      return decrypted;
    }

    return null;
  } catch (error) {
    console.warn('Unable to authenticate or decrypt PulseChat local data:', error);
    return null;
  }
}

export async function localVaultRemove(key: string) {
  browserMemoryVault.delete(key);
  await AsyncStorage.removeItem(key);
}

export async function localVaultGetAllKeys() {
  if (Platform.OS === 'web') {
    const persistedKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = persistedKeys.filter((key) => (
      key.startsWith('pulsechat.cache.v1:') || key.startsWith('pulsechat.outbox.v1:')
    ));
    if (legacyKeys.length > 0) await AsyncStorage.removeMany(legacyKeys);
    return [...browserMemoryVault.keys()];
  }
  return AsyncStorage.getAllKeys();
}

export async function localVaultMultiRemove(keys: readonly string[]) {
  if (keys.length === 0) return;
  keys.forEach((key) => browserMemoryVault.delete(key));
  await AsyncStorage.removeMany([...keys]);
}

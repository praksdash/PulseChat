import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const MASTER_KEY_NAME = 'pulsechat_offline_vault_key_v1';
const ENVELOPE_VERSION = 1;

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

function createCounterValue() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return bytes.reduce((value, byte) => value * 256 + byte, 0);
}

export async function localVaultSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const masterKey = await getMasterKey();
  const counter = createCounterValue();
  const cipher = new aesjs.ModeOfOperation.ctr(masterKey, new aesjs.Counter(counter));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  const envelope: EncryptedEnvelope = {
    v: ENVELOPE_VERSION,
    counter,
    cipher: aesjs.utils.hex.fromBytes(encrypted),
  };
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
}

export async function localVaultGet(key: string) {
  const stored = await AsyncStorage.getItem(key);
  if (!stored || Platform.OS === 'web') return stored;

  try {
    const envelope = JSON.parse(stored) as EncryptedEnvelope;
    if (
      envelope?.v !== ENVELOPE_VERSION
      || typeof envelope.counter !== 'number'
      || typeof envelope.cipher !== 'string'
    ) {
      return null;
    }

    const masterKey = await getMasterKey();
    const cipher = new aesjs.ModeOfOperation.ctr(masterKey, new aesjs.Counter(envelope.counter));
    const decrypted = cipher.decrypt(aesjs.utils.hex.toBytes(envelope.cipher));
    return aesjs.utils.utf8.fromBytes(decrypted);
  } catch (error) {
    console.warn('Unable to decrypt PulseChat local data:', error);
    return null;
  }
}

export async function localVaultRemove(key: string) {
  await AsyncStorage.removeItem(key);
}

export async function localVaultGetAllKeys() {
  return AsyncStorage.getAllKeys();
}

export async function localVaultMultiRemove(keys: readonly string[]) {
  if (keys.length === 0) return;
  await AsyncStorage.removeMany([...keys]);
}

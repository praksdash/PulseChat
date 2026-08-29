import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';
import {
  decryptAuthenticatedString,
  encryptAuthenticatedString,
} from '@/utils/secure-envelope';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

// Expo SecureStore has a small per-value limit on some platforms. Supabase's
// documented approach stores an AES-256 key in SecureStore and the encrypted
// session payload in AsyncStorage.
class LargeSecureStore {
  private readonly encryptionKeyPromises = new Map<string, Promise<Uint8Array>>();

  private async getOrCreateEncryptionKey(storageKey: string) {
    const inFlight = this.encryptionKeyPromises.get(storageKey);
    if (inFlight) return inFlight;

    const operation = (async () => {
      const existing = await SecureStore.getItemAsync(storageKey);
      if (existing) return aesjs.utils.hex.toBytes(existing);

      const generated = crypto.getRandomValues(new Uint8Array(32));
      await SecureStore.setItemAsync(storageKey, aesjs.utils.hex.fromBytes(generated));
      return generated;
    })();

    this.encryptionKeyPromises.set(storageKey, operation);
    try {
      return await operation;
    } catch (error) {
      if (this.encryptionKeyPromises.get(storageKey) === operation) {
        this.encryptionKeyPromises.delete(storageKey);
      }
      throw error;
    }
  }

  private async encrypt(storageKey: string, value: string) {
    const encryptionKey = await this.getOrCreateEncryptionKey(storageKey);
    return encryptAuthenticatedString(encryptionKey, value, storageKey);
  }

  private async decrypt(storageKey: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(storageKey);
    if (!encryptionKeyHex) return null;

    const encryptionKey = aesjs.utils.hex.toBytes(encryptionKeyHex);
    try {
      return decryptAuthenticatedString(encryptionKey, value, storageKey);
    } catch {
      // Upgrade a valid Phase 19 AES-CTR session to AES-256-GCM after the first
      // successful read. Legacy payloads were raw hex rather than JSON.
      if (!/^(?:[0-9a-f]{2})+$/i.test(value)) return null;
      try {
        const legacyCipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
        const decrypted = aesjs.utils.utf8.fromBytes(
          legacyCipher.decrypt(aesjs.utils.hex.toBytes(value)),
        );
        const upgraded = await this.encrypt(storageKey, decrypted);
        await AsyncStorage.setItem(storageKey, upgraded);
        return decrypted;
      } catch {
        return null;
      }
    }
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return encrypted;
    return this.decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    this.encryptionKeyPromises.delete(key);
    await Promise.all([AsyncStorage.removeItem(key), SecureStore.deleteItemAsync(key)]);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

class BrowserSessionStorage {
  private readonly serverFallback = new Map<string, string>();

  private getBrowserStores() {
    if (typeof window === 'undefined') return null;
    return { session: window.sessionStorage, local: window.localStorage };
  }

  getItem(key: string) {
    const stores = this.getBrowserStores();
    if (!stores) return this.serverFallback.get(key) ?? null;

    const current = stores.session.getItem(key);
    if (current) return current;

    // Remove the Phase 20 persistent browser session while allowing one
    // same-tab migration so users are not unexpectedly signed out on upgrade.
    const legacy = stores.local.getItem(key);
    if (legacy) {
      stores.session.setItem(key, legacy);
      stores.local.removeItem(key);
    }
    return legacy;
  }

  removeItem(key: string) {
    const stores = this.getBrowserStores();
    if (!stores) {
      this.serverFallback.delete(key);
      return;
    }
    stores.session.removeItem(key);
    stores.local.removeItem(key);
  }

  setItem(key: string, value: string) {
    const stores = this.getBrowserStores();
    if (!stores) {
      this.serverFallback.set(key, value);
      return;
    }
    stores.session.setItem(key, value);
    stores.local.removeItem(key);
  }
}

// Keeping the client constructible lets the app render a setup message instead
// of crashing before .env is configured.
const supabaseUrl = configuredUrl || 'https://placeholder.supabase.co';
const supabasePublishableKey = configuredKey || 'sb_publishable_placeholder';

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: Platform.OS === 'web' ? new BrowserSessionStorage() : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

import type { Session, User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  isSupabaseConfigured,
  setSupabaseSessionAccessToken,
  supabase,
} from '@/lib/supabase';
import { clearChatMediaSignedUrlCache } from '@/services/media-service';
import { isRetryableNetworkError } from '@/services/network-error-service';
import { registerForPushNotifications, resumePushRegistration, suspendPushRegistration, unregisterNativePushNotifications } from '@/services/push-notification-service';
import { disableStoredExpoPushToken } from '@/services/push-token-service';
import type { Profile } from '@/types/profile';
import { getFriendlyAuthError } from '@/utils/auth-errors';

export type SignUpResult = {
  error: string | null;
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isProfileLoading: boolean;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (displayName: string, email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const missingConfigurationMessage =
  'Supabase is not configured. Create .env from .env.example and add your project URL and publishable key.';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const signedUrlCacheOwnerRef = useRef<string | null>(null);
  const profileRequestSequenceRef = useRef(0);
  const sessionUserId = session?.user.id;

  const applySession = useCallback((nextSession: Session | null) => {
    // Update the native request fallback before rendering authenticated
    // screens, so their first RPC cannot race ahead of secure storage.
    setSupabaseSessionAccessToken(nextSession?.access_token);
    setSession(nextSession);
  }, []);

  useEffect(() => {
    const nextOwner = sessionUserId ?? null;
    if (signedUrlCacheOwnerRef.current === nextOwner) return;
    clearChatMediaSignedUrlCache();
    signedUrlCacheOwnerRef.current = nextOwner;
  }, [sessionUserId]);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestSequenceRef.current;
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_path, bio, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Unable to load profile:', error.message);
        if (requestId === profileRequestSequenceRef.current) setProfile(null);
        return;
      }

      if (requestId === profileRequestSequenceRef.current) {
        setProfile((data as Profile | null) ?? null);
      }
    } finally {
      if (requestId === profileRequestSequenceRef.current) setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!sessionUserId || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    await loadProfile(sessionUserId);
  }, [loadProfile, sessionUserId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isSupabaseConfigured) return;

    if (AppState.currentState === 'active') {
      void supabase.auth.startAutoRefresh();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsInitializing(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(async ({ data, error }: { data: { session: Session | null }; error: Error | null }) => {
      if (!mounted) return;
      if (error) console.warn('Unable to restore auth session:', error.message);

      let restoredSession = data.session ?? null;
      if (Platform.OS !== 'web' && restoredSession) {
        const validation = await supabase.auth.getUser(restoredSession.access_token);
        if (!mounted) return;
        if (validation.error && !isRetryableNetworkError(validation.error)) {
          console.warn('Stored Android session is no longer valid. Sign-in is required.');
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          restoredSession = null;
        } else if (validation.data.user) {
          restoredSession = { ...restoredSession, user: validation.data.user };
        }
      }

      applySession(restoredSession);
      setIsInitializing(false);
    }).catch((restoreError: unknown) => {
      if (!mounted) return;
      console.warn('Unable to initialize auth session:', restoreError);
      applySession(null);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      if (!mounted) return;
      applySession(nextSession);
      setIsInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    if (!sessionUserId || !isSupabaseConfigured) {
      profileRequestSequenceRef.current += 1;
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }
    setProfile((current) => current?.id === sessionUserId ? current : null);
    void loadProfile(sessionUserId);
  }, [loadProfile, sessionUserId]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return missingConfigurationMessage;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (data.session) applySession(data.session);
    return error ? getFriendlyAuthError(error) : null;
  }, [applySession]);

  const signUp = useCallback(async (displayName: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: missingConfigurationMessage, requiresEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    });

    if (error) {
      return { error: getFriendlyAuthError(error), requiresEmailConfirmation: false };
    }

    if (data.session) applySession(data.session);

    return {
      error: null,
      requiresEmailConfirmation: Boolean(data.user && !data.session),
    };
  }, [applySession]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return missingConfigurationMessage;

    suspendPushRegistration();

    try {
      await disableStoredExpoPushToken();
    } catch (pushError) {
      console.warn('Unable to disable push token during sign out:', pushError);
    }

    try {
      // Even if the database call above could not reach the network, unregister
      // the native installation so a signed-out device does not keep receiving
      // chat previews for the previous account.
      await unregisterNativePushNotifications();
    } catch (nativePushError) {
      console.warn('Unable to unregister native push notifications:', nativePushError);
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      resumePushRegistration();
      void registerForPushNotifications().catch(() => undefined);
      return getFriendlyAuthError(error);
    }

    applySession(null);
    setProfile(null);
    return null;
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAuthenticated: Boolean(session?.user),
      isInitializing,
      isProfileLoading,
      configurationError: isSupabaseConfigured ? null : missingConfigurationMessage,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [isInitializing, isProfileLoading, profile, refreshProfile, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

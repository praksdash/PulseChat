import type { Session, User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
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

  const loadProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_path, bio, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Unable to load profile:', error.message);
        setProfile(null);
        return;
      }

      setProfile((data as Profile | null) ?? null);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    await loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

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

    void supabase.auth.getSession().then(({ data, error }: { data: { session: Session | null }; error: Error | null }) => {
      if (!mounted) return;
      if (error) console.warn('Unable to restore auth session:', error.message);
      setSession(data.session ?? null);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id || !isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    void loadProfile(session.user.id);
  }, [loadProfile, session?.user.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return missingConfigurationMessage;

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    return error ? getFriendlyAuthError(error) : null;
  }, []);

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

    return {
      error: null,
      requiresEmailConfirmation: Boolean(data.user && !data.session),
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return missingConfigurationMessage;

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return getFriendlyAuthError(error);

    setSession(null);
    setProfile(null);
    return null;
  }, []);

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

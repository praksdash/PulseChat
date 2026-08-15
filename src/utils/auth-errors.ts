import type { AuthError } from '@supabase/supabase-js';

export function getFriendlyAuthError(error: AuthError | Error | null | undefined) {
  if (!error) return 'Something went wrong. Please try again.';

  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'An account already exists for this email.';
  }
  if (message.includes('password') && message.includes('least')) {
    return 'Your password does not meet the required strength.';
  }
  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Unable to reach PulseChat. Check your internet connection.';
  }

  return error.message || 'Authentication failed. Please try again.';
}

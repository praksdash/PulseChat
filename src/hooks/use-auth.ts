import { useContext } from 'react';

import { AuthContext } from '@/providers/auth-provider';

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}

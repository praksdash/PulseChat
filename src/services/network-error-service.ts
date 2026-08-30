export function getErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export function isRetryableNetworkError(error: unknown) {
  const message = getErrorText(error).toLowerCase();
  return [
    'failed to fetch',
    'network request failed',
    'network error',
    'networkerror',
    'timeout',
    'timed out',
    'connection',
    'socket',
    'offline',
    'load failed',
    'fetch failed',
  ].some((needle) => message.includes(needle));
}

export function isSessionAuthorizationError(error: unknown) {
  const message = getErrorText(error).toLowerCase();
  return message.includes('permission denied for function')
    || message.includes('jwt expired')
    || message.includes('invalid jwt')
    || message.includes('jwt issued at future');
}

export function getAuthenticatedRequestError(error: unknown, fallback: string) {
  if (isSessionAuthorizationError(error)) {
    return 'Your secure session could not be verified. Please sign out and sign in again.';
  }
  return isRetryableNetworkError(error)
    ? 'Check your connection and try again.'
    : fallback;
}

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

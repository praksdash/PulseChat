export type DiagnosticEventType = 'crash' | 'startup' | 'api_latency';
export type DiagnosticOutcome = 'ok' | 'error';

export type DiagnosticEvent = {
  event_type: DiagnosticEventType;
  operation: string;
  platform: 'android' | 'ios' | 'web' | 'unknown';
  app_version: string;
  build_profile: string;
  duration_ms: number | null;
  outcome: DiagnosticOutcome;
  status_code: number | null;
  error_fingerprint: string | null;
  occurred_at: string;
};

const MAX_BUFFERED_EVENTS = 50;
const OPERATION_PATTERN = /[^a-z0-9_.-]+/g;
const bufferedEvents: DiagnosticEvent[] = [];

export function sanitizeDiagnosticOperation(value: string) {
  const normalized = value.trim().toLowerCase().replace(OPERATION_PATTERN, '_').slice(0, 64);
  return normalized || 'unknown';
}

export function fingerprintDiagnostic(value: string) {
  // FNV-1a is used only as a non-reversible grouping key. No error message or
  // stack is uploaded to the diagnostics table.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function enqueueDiagnostic(event: DiagnosticEvent) {
  bufferedEvents.push({
    ...event,
    operation: sanitizeDiagnosticOperation(event.operation),
    duration_ms: event.duration_ms === null
      ? null
      : Math.max(0, Math.min(120_000, Math.round(event.duration_ms))),
    status_code: event.status_code === null
      ? null
      : Math.max(100, Math.min(599, Math.trunc(event.status_code))),
    error_fingerprint: event.error_fingerprint?.slice(0, 64) ?? null,
  });
  if (bufferedEvents.length > MAX_BUFFERED_EVENTS) {
    bufferedEvents.splice(0, bufferedEvents.length - MAX_BUFFERED_EVENTS);
  }
}

export function takeDiagnostics(limit = 20) {
  return bufferedEvents.splice(0, Math.max(0, Math.min(20, Math.trunc(limit))));
}

export function requeueDiagnostics(events: DiagnosticEvent[]) {
  if (events.length === 0) return;
  bufferedEvents.unshift(...events);
  if (bufferedEvents.length > MAX_BUFFERED_EVENTS) {
    bufferedEvents.length = MAX_BUFFERED_EVENTS;
  }
}

export function getBufferedDiagnosticCount() {
  return bufferedEvents.length;
}

export function clearBufferedDiagnostics() {
  bufferedEvents.length = 0;
}

export function classifySupabaseRequest(urlValue: string, methodValue?: string) {
  let path = '';
  try {
    path = new URL(urlValue).pathname;
  } catch {
    return 'supabase.unknown';
  }

  const method = (methodValue || 'GET').toLowerCase();
  if (path.includes('/rest/v1/rpc/')) {
    const rpcName = path.split('/rest/v1/rpc/')[1]?.split('/')[0] || 'unknown';
    return `rpc.${sanitizeDiagnosticOperation(rpcName)}`;
  }
  if (path.includes('/rest/v1/')) {
    const tableName = path.split('/rest/v1/')[1]?.split('/')[0] || 'unknown';
    return `rest.${method}.${sanitizeDiagnosticOperation(tableName)}`;
  }
  if (path.includes('/auth/v1/')) return `auth.${method}`;
  if (path.includes('/storage/v1/')) return `storage.${method}`;
  if (path.includes('/realtime/v1/')) return 'realtime.connect';
  if (path.includes('/functions/v1/')) {
    const functionName = path.split('/functions/v1/')[1]?.split('/')[0] || 'unknown';
    return `function.${sanitizeDiagnosticOperation(functionName)}`;
  }
  return 'supabase.other';
}

export function shouldCaptureApiDiagnostic(statusCode: number, durationMs: number, sample: number) {
  return statusCode >= 400 || durationMs >= 1_000 || sample < 0.1;
}

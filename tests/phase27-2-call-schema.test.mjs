import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = fs.readFileSync(
  path.join(
    projectRoot,
    'supabase/migrations/202608300020_phase27_2_one_to_one_calls.sql',
  ),
  'utf8',
).toLowerCase();
const verification = fs.readFileSync(
  path.join(projectRoot, 'supabase/phase27_2_verify.sql'),
  'utf8',
).toLowerCase();

test('Phase 27.2 creates bounded one-to-one call metadata tables', () => {
  assert.match(migration, /create table if not exists public\.call_sessions/);
  assert.match(migration, /create table if not exists public\.call_participants/);
  assert.match(migration, /call_type in \('voice', 'video'\)/);
  assert.match(migration, /caller_user_id <> callee_user_id/);
  assert.match(migration, /calls require an existing direct conversation/);
  assert.match(migration, /call_sessions_one_open_per_conversation_idx/);
});

test('Phase 27.2 seeds exactly the declared caller and callee roles', () => {
  assert.match(migration, /create or replace function pulsechat_private\.seed_call_participants/);
  assert.match(migration, /\(new\.id, new\.caller_user_id, 'caller', new\.created_at\)/);
  assert.match(migration, /\(new\.id, new\.callee_user_id, 'callee', new\.created_at\)/);
  assert.match(migration, /call_participants_one_role_per_call/);
  assert.match(migration, /call participant does not match the session party/);
});

test('Phase 27.2 call state transitions and terminal records are bounded', () => {
  assert.match(migration, /when 'ringing' then new\.status in/);
  assert.match(migration, /when 'accepted' then new\.status in/);
  assert.match(migration, /when 'active' then new\.status in/);
  assert.match(migration, /a terminal call session is immutable/);
  assert.match(migration, /new\.version := old\.version \+ 1/);
});

test('Phase 27.2 exposes party-only reads and no direct client writes', () => {
  assert.match(migration, /alter table public\.call_sessions enable row level security/);
  assert.match(migration, /alter table public\.call_participants enable row level security/);
  assert.match(migration, /caller_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /callee_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /grant select on table public\.call_sessions to authenticated/);
  assert.match(migration, /grant select on table public\.call_participants to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).*call_(sessions|participants).*authenticated/);
  assert.doesNotMatch(migration, /create policy[^;]+for (insert|update|delete|all)/s);
});

test('Phase 27.2 verification checks RLS, privileges, policies and triggers', () => {
  assert.match(verification, /phase 27\.2 call tables are missing/);
  assert.match(verification, /direct authenticated call writes must remain revoked/);
  assert.match(verification, /party-only select policies are missing/);
  assert.match(verification, /validation\/participant seeding triggers are missing/);
  assert.match(verification, /anonymous_cannot_read_calls/);
});

test('Phase 27.2 does not install a calling SDK or expose a token secret', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
  );
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  for (const dependency of Object.keys(allDependencies)) {
    assert.doesNotMatch(dependency, /livekit|agora|stream-video|webrtc/i);
  }
  assert.doesNotMatch(migration, /livekit_api_(key|secret)/);
});


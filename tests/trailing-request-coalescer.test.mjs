import assert from 'node:assert/strict';
import test from 'node:test';

import { createTrailingRequestCoalescer } from '../src/utils/trailing-request-coalescer.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('same-key bursts collapse into one latest trailing request', async () => {
  const coalescer = createTrailingRequestCoalescer();
  const gate = deferred();
  const calls = [];

  const first = coalescer.run('conversation-a', async () => {
    calls.push('first');
    await gate.promise;
  });
  const joined = coalescer.run('conversation-a', async () => {
    calls.push('superseded');
  });
  const latest = coalescer.run('conversation-a', async () => {
    calls.push('latest');
  });

  assert.equal(joined, first);
  assert.equal(latest, first);
  gate.resolve();
  await first;
  assert.deepEqual(calls, ['first', 'latest']);
});

test('different conversation keys do not block each other', async () => {
  const coalescer = createTrailingRequestCoalescer();
  const gate = deferred();
  const calls = [];

  const first = coalescer.run('conversation-a', async () => {
    calls.push('a-start');
    await gate.promise;
    calls.push('a-end');
  });
  const second = coalescer.run('conversation-b', async () => {
    calls.push('b');
  });

  await second;
  assert.deepEqual(calls, ['a-start', 'b']);
  gate.resolve();
  await first;
  assert.deepEqual(calls, ['a-start', 'b', 'a-end']);
});

test('a failed request is removed so the key can run again', async () => {
  const coalescer = createTrailingRequestCoalescer();

  await assert.rejects(
    coalescer.run('conversation-a', async () => {
      throw new Error('network failure');
    }),
    /network failure/,
  );

  let reran = false;
  await coalescer.run('conversation-a', async () => {
    reran = true;
  });
  assert.equal(reran, true);
});

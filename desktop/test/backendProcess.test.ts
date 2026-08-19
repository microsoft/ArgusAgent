import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { terminateWindowsProcessTree } from '../src/main/backendProcess';

function fakeChild() {
  return {
    once: mock.fn((_event: string, _listener: (...args: unknown[]) => void) => undefined),
  };
}

test('an already-dead process succeeds without invoking taskkill', async () => {
  const spawnTreeKiller = mock.fn(() => fakeChild());
  assert.equal(await terminateWindowsProcessTree(123, {
    isAlive: () => false,
    spawnTreeKiller,
  }), true);
  assert.equal(spawnTreeKiller.mock.callCount(), 0);
});

test('taskkill succeeds only after liveness becomes false', async () => {
  let probes = 0;
  const stopped = await terminateWindowsProcessTree(456, {
    isAlive: () => ++probes < 4,
    spawnTreeKiller: () => fakeChild(),
    timeoutMs: 100,
    pollIntervalMs: 1,
  });
  assert.equal(stopped, true);
});

test('a still-live process fails closed so ownership can be retained', async () => {
  const stopped = await terminateWindowsProcessTree(789, {
    isAlive: () => true,
    spawnTreeKiller: () => fakeChild(),
    timeoutMs: 5,
    pollIntervalMs: 1,
  });
  assert.equal(stopped, false);
});

test('a taskkill spawn error still succeeds after a concurrent exit', async () => {
  let probes = 0;
  const stopped = await terminateWindowsProcessTree(987, {
    isAlive: () => ++probes === 1,
    spawnTreeKiller: () => { throw new Error('taskkill unavailable'); },
    timeoutMs: 5,
    pollIntervalMs: 1,
  });
  assert.equal(stopped, true);
});

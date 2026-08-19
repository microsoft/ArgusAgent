import assert from 'node:assert/strict';
import test from 'node:test';
import { installParentExitGuard } from '../src/parentExitGuard.js';

test('Windows child exits when its launcher parent disappears', () => {
  let poll: (() => void) | undefined;
  let unrefCalled = false;
  let exited = false;
  let alive = true;
  const timer = { unref: () => { unrefCalled = true; } };

  const installed = installParentExitGuard({
    platform: 'win32',
    parentPid: 42,
    isProcessAlive: () => alive,
    onParentExit: () => { exited = true; },
    setIntervalFn: ((callback: () => void) => {
      poll = callback;
      return timer;
    }) as unknown as typeof setInterval,
  });

  assert.equal(installed, timer);
  assert.equal(unrefCalled, true);
  poll?.();
  assert.equal(exited, false);
  alive = false;
  poll?.();
  assert.equal(exited, true);
});

test('non-Windows launchers do not install the polling guard', () => {
  assert.equal(installParentExitGuard({ platform: 'linux', parentPid: 42 }), null);
});

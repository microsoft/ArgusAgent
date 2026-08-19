import assert from 'node:assert/strict';
import test from 'node:test';

import { captureIpc, ipcErrorDetail } from '../src/renderer/ipcRecovery';

test('captures successful IPC values without changing their shape', async () => {
  assert.deepEqual(await captureIpc(async () => ({ state: 'ready', pid: 42 })), {
    ok: true,
    value: { state: 'ready', pid: 42 },
  });
});

test('turns rejected IPC calls into renderable error state', async () => {
  assert.deepEqual(await captureIpc(async () => {
    throw new Error('main process unavailable');
  }), {
    ok: false,
    detail: 'Error: main process unavailable',
  });
});

test('normalises non-Error IPC rejection values', () => {
  assert.equal(ipcErrorDetail('channel closed'), 'channel closed');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldHideWindowOnClose,
  shouldStopBackendOnQuit,
} from '../src/main/windowLifecycle';

test('only an ordinary native close hides the Desktop shell', () => {
  assert.equal(shouldHideWindowOnClose(false, false), true);
  assert.equal(shouldHideWindowOnClose(true, false), false);
  assert.equal(shouldHideWindowOnClose(false, true), false);
});

test('only explicit stop-and-quit stops the owned backend', () => {
  assert.equal(shouldStopBackendOnQuit(false), false);
  assert.equal(shouldStopBackendOnQuit(true), true);
});

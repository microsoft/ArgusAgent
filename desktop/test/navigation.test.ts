import assert from 'node:assert/strict';
import test from 'node:test';

import { isRetryableNavigationError, LatestNavigation } from '../src/main/navigation';

test('recognises Electron transient navigation failures only', () => {
  assert.equal(
    isRetryableNavigationError(new Error("ERR_FAILED (-2) loading 'file:///index.html'")),
    true
  );
  assert.equal(isRetryableNavigationError(new Error('ERR_ABORTED (-3)')), true);
  assert.equal(isRetryableNavigationError(new Error('ERR_FILE_NOT_FOUND (-6)')), false);
});

test('retries a transient navigation and eventually succeeds', async () => {
  const navigation = new LatestNavigation();
  let calls = 0;
  const outcome = await navigation.run(async () => {
    calls += 1;
    if (calls === 1) throw new Error('ERR_FAILED (-2) loading local renderer');
  }, { retryDelaysMs: [0] });

  assert.equal(outcome, 'loaded');
  assert.equal(calls, 2);
});

test('a newer destination supersedes stale retries without surfacing an error', async () => {
  const navigation = new LatestNavigation();
  let releaseFirst!: () => void;
  const firstAttempt = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const stale = navigation.run(async () => {
    await firstAttempt;
    throw new Error('ERR_FAILED (-2) loading stale destination');
  }, { retryDelaysMs: [0] });
  const latest = navigation.run(async () => undefined, { retryDelaysMs: [] });
  releaseFirst();

  assert.equal(await latest, 'loaded');
  assert.equal(await stale, 'superseded');
});

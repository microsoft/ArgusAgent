import assert from 'node:assert/strict';
import test from 'node:test';

import { BackendResiliencePolicy } from '../src/main/backendResilience';

const options = {
  transientFailureThreshold: 3,
  healthRetryDelaysMs: [10, 20],
  automaticRestartDelaysMs: [30, 40, 50]
} as const;

test('requires consecutive transient failures before recovering a live backend', () => {
  const policy = new BackendResiliencePolicy(options);

  assert.deepEqual(
    policy.recordHealthFailure({ identityConflict: false, processAlive: true }),
    { action: 'retry', failureCount: 1, delayMs: 10 }
  );
  assert.deepEqual(
    policy.recordHealthFailure({ identityConflict: false, processAlive: true }),
    { action: 'retry', failureCount: 2, delayMs: 20 }
  );
  assert.deepEqual(
    policy.recordHealthFailure({ identityConflict: false, processAlive: true }),
    { action: 'recover', failureCount: 3 }
  );
});

test('a successful sample clears only the transient failure streak', () => {
  const policy = new BackendResiliencePolicy(options);
  policy.recordHealthFailure({ identityConflict: false, processAlive: true });
  assert.equal(policy.healthFailureCount, 1);

  policy.recordHealthSuccess();

  assert.equal(policy.healthFailureCount, 0);
  assert.deepEqual(
    policy.recordHealthFailure({ identityConflict: false, processAlive: true }),
    { action: 'retry', failureCount: 1, delayMs: 10 }
  );
});

test('recovers a dead process immediately but never masks an identity conflict', () => {
  const deadPolicy = new BackendResiliencePolicy(options);
  assert.deepEqual(
    deadPolicy.recordHealthFailure({ identityConflict: false, processAlive: false }),
    { action: 'recover', failureCount: 1 }
  );

  const conflictPolicy = new BackendResiliencePolicy(options);
  assert.deepEqual(
    conflictPolicy.recordHealthFailure({ identityConflict: true, processAlive: true }),
    { action: 'fail', failureCount: 1 }
  );
});

test('bounds automatic restarts and resets the circuit only after stability', () => {
  const policy = new BackendResiliencePolicy(options);

  assert.deepEqual(policy.beginAutomaticRecovery(), {
    allowed: true,
    attempt: 1,
    maxAttempts: 3,
    delayMs: 30
  });
  policy.recordHealthSuccess();
  assert.equal(policy.restartAttemptCount, 1);
  assert.equal(policy.beginAutomaticRecovery().allowed, true);
  assert.equal(policy.beginAutomaticRecovery().allowed, true);
  assert.deepEqual(policy.beginAutomaticRecovery(), {
    allowed: false,
    attempts: 3,
    maxAttempts: 3
  });

  policy.markRuntimeStable();
  assert.equal(policy.restartAttemptCount, 0);
  assert.equal(policy.beginAutomaticRecovery().allowed, true);
});

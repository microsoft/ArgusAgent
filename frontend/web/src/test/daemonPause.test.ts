import { describe, expect, it } from 'vitest';
import { PAUSE_DAEMON_DRAIN } from '../useProjectDaemonActions';

describe('visible daemon pause semantics', () => {
  it('interrupts the current operation instead of waiting for a boundary drain', () => {
    expect(PAUSE_DAEMON_DRAIN).toBe(false);
  });
});

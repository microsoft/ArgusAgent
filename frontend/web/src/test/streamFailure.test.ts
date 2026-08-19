import { describe, expect, it } from 'vitest';

import { managerStreamFailureMessage } from '../lib/format';

describe('manager stream failure notices', () => {
  it('distinguishes an interrupted partial reply from a pre-reply failure', () => {
    const error = new Error('connection lost');

    expect(managerStreamFailureMessage(error, true)).toContain('partial response');
    expect(managerStreamFailureMessage(error, false)).toContain(
      'before a response was received',
    );
  });
});

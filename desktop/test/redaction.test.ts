import assert from 'node:assert/strict';
import test from 'node:test';

import { redactSensitiveText } from '../src/main/redaction';

test('redacts JSON, URL query, websocket, and bearer credentials', () => {
  const raw = [
    '{"token": "json-secret"}',
    'GET /?token=url-secret HTTP/1.1',
    'WebSocket /stream?replay=40&token=ws-secret [accepted]',
    'Authorization: Bearer bearer-secret'
  ].join('\n');
  const redacted = redactSensitiveText(raw);

  assert.equal(redacted.includes('json-secret'), false);
  assert.equal(redacted.includes('url-secret'), false);
  assert.equal(redacted.includes('ws-secret'), false);
  assert.equal(redacted.includes('bearer-secret'), false);
  assert.match(redacted, /"token": "<redacted>"/);
  assert.match(redacted, /\?token=<redacted>/);
  assert.match(redacted, /&token=<redacted>/);
  assert.match(redacted, /Bearer <redacted>/);
});

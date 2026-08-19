import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  installConsolePipeGuard,
  isBrokenPipeError,
  type ConsoleTransportLike,
} from '../src/main/loggerSafety';

function transport(writeFn: (payload: unknown) => void): ConsoleTransportLike {
  return { level: 'silly', writeFn };
}

test('recognises Windows broken-pipe errors by code', () => {
  assert.equal(isBrokenPipeError(Object.assign(new Error('broken pipe'), { code: 'EPIPE' })), true);
  assert.equal(isBrokenPipeError(Object.assign(new Error('missing'), { code: 'ENOENT' })), false);
  assert.equal(isBrokenPipeError(null), false);
});

test('a synchronous EPIPE disables the console transport without recursion', () => {
  let writes = 0;
  const target = transport(() => {
    writes += 1;
    throw Object.assign(new Error('broken pipe'), { code: 'EPIPE' });
  });
  installConsolePipeGuard(target, []);

  assert.doesNotThrow(() => target.writeFn({ message: 'first' }));
  assert.equal(target.level, false);
  assert.doesNotThrow(() => target.writeFn({ message: 'second' }));
  assert.equal(writes, 1);
});

test('an asynchronous stream error disables future console writes', () => {
  const stream = new EventEmitter();
  let writes = 0;
  const target = transport(() => {
    writes += 1;
  });
  installConsolePipeGuard(target, [stream]);

  stream.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }));
  target.writeFn({ message: 'ignored' });

  assert.equal(target.level, false);
  assert.equal(writes, 0);
});

test('non-EPIPE synchronous transport failures remain visible', () => {
  const failure = Object.assign(new Error('permission denied'), { code: 'EACCES' });
  const target = transport(() => {
    throw failure;
  });
  installConsolePipeGuard(target, []);

  assert.throws(() => target.writeFn({ message: 'fail' }), failure);
  assert.equal(target.level, 'silly');
});

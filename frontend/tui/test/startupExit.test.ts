import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import React from 'react';
import { render, Text } from 'ink';

import { StartupExitKeys } from '../src/components/StartupExitKeys.js';

function terminalStream() {
  const stream = new PassThrough() as PassThrough & {
    columns: number;
    rows: number;
    isTTY: boolean;
    setRawMode: (enabled: boolean) => PassThrough;
    ref: () => PassThrough;
    unref: () => PassThrough;
  };
  stream.columns = 80;
  stream.rows = 24;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}

for (const [name, key] of [['Ctrl-C', '\u0003'], ['Ctrl-D', '\u0004']] as const) {
  test(`${name} exits splash/connecting/error startup surfaces`, async () => {
    const stdin = terminalStream();
    const stdout = terminalStream();
    let exitObserved = false;
    const instance = render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(StartupExitKeys, {
          active: true,
          onExit: () => { exitObserved = true; },
        }),
        React.createElement(Text, null, 'connecting'),
      ),
      {
        stdin: stdin as never,
        stdout: stdout as never,
        exitOnCtrlC: false,
        patchConsole: false,
      },
    );
    stdin.write(key);
    await Promise.race([
      instance.waitUntilExit(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('startup key did not exit')), 500)),
    ]);
    assert.equal(exitObserved, true);
  });
}

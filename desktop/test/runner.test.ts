import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  detectRunners,
  isRunnerKind,
  resolveRunnerBinary,
  RUNNER_KINDS,
  RUNNER_LABELS,
  type RunnerResolutionContext,
} from '../src/main/runner';

function isolatedContext(): { root: string; context: RunnerResolutionContext } {
  const root = mkdtempSync(join(tmpdir(), 'argus-desktop-runner-'));
  const home = join(root, 'home');
  const appData = join(root, 'appdata');
  const localAppData = join(root, 'localappdata');
  const path = join(root, 'path');
  for (const dir of [home, appData, localAppData, path]) mkdirSync(dir, { recursive: true });
  return { root, context: { home, appData, localAppData, path } };
}

function executable(path: string): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '@echo off\r\n', 'utf-8');
  return path;
}

test('all external CLIs are first-class supported runner kinds', () => {
  for (const kind of ['opencode', 'grok', 'qoder', 'dsh'] as const) {
    assert.equal(isRunnerKind(kind), true);
    assert.equal(RUNNER_KINDS.includes(kind), true);
  }
  assert.equal(RUNNER_LABELS.opencode, 'OpenCode');
  assert.equal(RUNNER_LABELS.grok, 'Grok Build');
  assert.equal(RUNNER_LABELS.qoder, 'Qoder CLI');
  assert.equal(RUNNER_LABELS.dsh, 'DeepSeek Harness');
});

test('detects OpenCode in its user-local installation without consulting the real home', (t) => {
  const { root, context } = isolatedContext();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const expected = executable(join(context.home!, '.opencode', 'bin', 'opencode.cmd'));

  assert.equal(resolveRunnerBinary('opencode', context), expected);
  assert.equal(detectRunners(context).opencode, expected);
});

test('detects Grok Build in LocalAppData and accepts PATH fallback', (t) => {
  const local = isolatedContext();
  t.after(() => rmSync(local.root, { recursive: true, force: true }));
  const installed = executable(join(local.context.localAppData!, 'Programs', 'grok', 'grok.exe'));
  assert.equal(resolveRunnerBinary('grok', local.context), installed);

  const fallback = isolatedContext();
  t.after(() => rmSync(fallback.root, { recursive: true, force: true }));
  const fromPath = executable(join(fallback.context.path!, 'grok.cmd'));
  assert.equal(resolveRunnerBinary('grok', fallback.context), fromPath);
});

test('detects Qoder and dsh from npm global or PATH', (t) => {
  const npm = isolatedContext();
  t.after(() => rmSync(npm.root, { recursive: true, force: true }));
  const qoder = executable(join(npm.context.appData!, 'npm', 'qodercli.cmd'));
  assert.equal(resolveRunnerBinary('qoder', npm.context), qoder);

  const fallback = isolatedContext();
  t.after(() => rmSync(fallback.root, { recursive: true, force: true }));
  const dsh = executable(join(fallback.context.path!, 'dsh.cmd'));
  assert.equal(resolveRunnerBinary('dsh', fallback.context), dsh);
});

test('the setup wizard exposes every external CLI choice', () => {
  const html = readFileSync(join(process.cwd(), 'src', 'renderer', 'index.html'), 'utf-8');
  assert.match(html, /data-kind="opencode">OpenCode</);
  assert.match(html, /data-kind="grok">Grok Build</);
  assert.match(html, /data-kind="qoder">Qoder CLI</);
  assert.match(html, /data-kind="dsh">DeepSeek Harness</);
});

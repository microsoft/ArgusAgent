import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  resolveDesktopReleaseIdentity,
  runtimeIdentityFromStatus,
} from '../src/main/releaseIdentity';

const digest = 'd'.repeat(64);

function manifest(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify({
    package_version: '0.1.1',
    release_id: '0.1.1+' + digest.slice(0, 16),
    source_digest: digest,
  }), 'utf-8');
}

test('development identity comes from the selected repository manifest', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'argus-release-dev-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  manifest(join(root, 'argus_skill', 'release_manifest.json'));

  assert.deepEqual(resolveDesktopReleaseIdentity({
    development: true,
    appVersion: '9.9.9',
    appPath: join(root, 'desktop'),
    resourcesPath: join(root, 'resources'),
    repoRoot: root,
  }), {
    packageVersion: '0.1.1',
    releaseId: '0.1.1+' + digest.slice(0, 16),
    sourceDigest: digest,
    distribution: 'development',
  });
});

test('packaged identity reads only the bundled backend manifest', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'argus-release-packaged-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  manifest(join(
    root,
    'resources',
    'argus-backend',
    '_internal',
    'argus_skill',
    'release_manifest.json',
  ));

  const identity = resolveDesktopReleaseIdentity({
    development: false,
    appVersion: '0.1.1',
    appPath: join(root, 'app'),
    resourcesPath: join(root, 'resources'),
  });
  assert.equal(identity.distribution, 'packaged');
  assert.equal(identity.releaseId, '0.1.1+' + digest.slice(0, 16));
  assert.equal(identity.sourceDigest, digest);
});

test('missing manifests fail visibly instead of claiming a source digest', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'argus-release-missing-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(resolveDesktopReleaseIdentity({
    development: false,
    appVersion: '0.1.1',
    appPath: root,
    resourcesPath: join(root, 'resources'),
  }), {
    packageVersion: '0.1.1',
    releaseId: '0.1.1+manifest-unavailable',
    sourceDigest: '',
    distribution: 'packaged',
  });
});

test('runtime identity mirrors only the supervisor status fields', () => {
  assert.deepEqual(runtimeIdentityFromStatus(null), { state: 'idle' });
  assert.deepEqual(runtimeIdentityFromStatus({
    state: 'ready',
    pid: 4242,
    url: 'http://127.0.0.1:8799',
  }), {
    state: 'ready',
    pid: 4242,
    url: 'http://127.0.0.1:8799',
  });
  assert.deepEqual(runtimeIdentityFromStatus({ state: 'error', url: '' }), {
    state: 'error',
  });
});

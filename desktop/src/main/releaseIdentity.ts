import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface DesktopReleaseIdentity {
  packageVersion: string;
  releaseId: string;
  sourceDigest: string;
  distribution: 'development' | 'packaged';
}

export interface ReleaseIdentityOptions {
  development: boolean;
  appVersion: string;
  appPath: string;
  resourcesPath: string;
  repoRoot?: string;
}

export interface DesktopRuntimeIdentity {
  state: string;
  pid?: number;
  url?: string;
}

/** Read only the manifest shipped by this distribution, never a user project. */
export function resolveDesktopReleaseIdentity(
  options: ReleaseIdentityOptions
): DesktopReleaseIdentity {
  const distribution = options.development ? 'development' : 'packaged';
  const repoRoot = options.repoRoot || resolve(options.appPath, '..');
  const manifestPath = options.development
    ? join(repoRoot, 'argus_skill', 'release_manifest.json')
    : join(
        options.resourcesPath,
        'argus-backend',
        '_internal',
        'argus_skill',
        'release_manifest.json'
      );
  try {
    const payload = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      package_version?: unknown;
      release_id?: unknown;
      source_digest?: unknown;
    };
    return {
      packageVersion: String(payload.package_version || options.appVersion),
      releaseId: String(payload.release_id || options.appVersion),
      sourceDigest: String(payload.source_digest || ''),
      distribution
    };
  } catch {
    return {
      packageVersion: options.appVersion,
      releaseId: `${options.appVersion}+manifest-unavailable`,
      sourceDigest: '',
      distribution
    };
  }
}

/** Keep the setup surface tied to the supervisor's current verified status. */
export function runtimeIdentityFromStatus(
  status?: Partial<DesktopRuntimeIdentity> | null
): DesktopRuntimeIdentity {
  return {
    state: String(status?.state || 'idle'),
    ...(typeof status?.pid === 'number' ? { pid: status.pid } : {}),
    ...(typeof status?.url === 'string' && status.url ? { url: status.url } : {})
  };
}

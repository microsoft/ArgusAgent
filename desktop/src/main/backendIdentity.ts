export interface BackendProbeIdentity {
  compatible: boolean;
  occupied: boolean;
  /** True only when /api/meta accepted this Desktop's bearer token. */
  authenticated?: boolean;
  detail?: string;
  pid?: number;
  executable?: string;
  manifestSourceDigest?: string;
  startedAt?: string;
  launchNonce?: string;
}

export interface BackendOwnership {
  schema: number;
  pid: number;
  rootPid: number;
  host: string;
  port: number;
  executable: string;
  manifestSourceDigest: string;
  tokenSha256: string;
  startedAt: string;
}

export interface ExpectedBackendIdentity {
  host: string;
  port: number;
  executable: string;
  manifestSourceDigest: string;
  tokenSha256: string;
}

export interface ExpectedBackendLaunch {
  launchNonce: string;
  manifestSourceDigest: string;
  spawnedAtMs: number;
  nowMs?: number;
}

/** Identity fields that remain stable while Desktop replaces its own release. */
export interface ExpectedPriorBackendOwnership {
  host: string;
  port: number;
  tokenSha256: string;
}

export interface ExpectedBundledBackendExecutable {
  executable: string;
}

/** Prove that a responding API came from this exact Desktop spawn attempt. */
export function backendLaunchClaimMatches(
  probe: BackendProbeIdentity,
  expected: ExpectedBackendLaunch
): boolean {
  const startedAtMs = Date.parse(probe.startedAt ?? '');
  const nowMs = expected.nowMs ?? Date.now();
  return (
    probe.compatible
    && probe.occupied === false
    && Number.isInteger(probe.pid)
    && Number(probe.pid) > 0
    && Boolean(probe.executable)
    && probe.launchNonce === expected.launchNonce
    && probe.manifestSourceDigest === expected.manifestSourceDigest
    && Number.isFinite(startedAtMs)
    // Allow a small clock/initialisation tolerance while rejecting an API that
    // predates this spawn or claims to have started in the future.
    && startedAtMs >= expected.spawnedAtMs - 5_000
    && startedAtMs <= nowMs + 5_000
  );
}

/** Strict proof that a live backend belongs to this desktop installation. */
export function backendOwnershipMatches(
  ownership: Partial<BackendOwnership>,
  probe: BackendProbeIdentity,
  expected: ExpectedBackendIdentity
): boolean {
  return (
    ownership.schema === 3
    && ownership.pid === probe.pid
    && Number.isInteger(ownership.rootPid)
    && Number(ownership.rootPid) > 0
    && ownership.host === expected.host
    && ownership.port === expected.port
    && ownership.executable?.toLowerCase() === expected.executable.toLowerCase()
    && probe.executable?.toLowerCase() === expected.executable.toLowerCase()
    && ownership.manifestSourceDigest === expected.manifestSourceDigest
    && probe.manifestSourceDigest === expected.manifestSourceDigest
    && ownership.tokenSha256 === expected.tokenSha256
    && Boolean(ownership.startedAt)
    && ownership.startedAt === probe.startedAt
  );
}

/**
 * Prove that an incompatible live API is the previous release launched by this
 * same Desktop identity.  The current release digest is deliberately *not*
 * compared: a digest mismatch is exactly why this controlled replacement path
 * exists.  Every live-process field still has to agree with the authenticated
 * ownership record before the supervisor may signal its runtime PID.
 */
export function priorBackendOwnershipMatches(
  ownership: Partial<BackendOwnership>,
  probe: BackendProbeIdentity,
  expected: ExpectedPriorBackendOwnership
): boolean {
  return (
    ownership.schema === 3
    && probe.occupied === true
    && Number.isInteger(ownership.pid)
    && ownership.pid === probe.pid
    && Number.isInteger(ownership.rootPid)
    && Number(ownership.rootPid) > 0
    && ownership.host === expected.host
    && ownership.port === expected.port
    && Boolean(ownership.executable)
    && ownership.executable?.toLowerCase() === probe.executable?.toLowerCase()
    && Boolean(ownership.manifestSourceDigest)
    && ownership.manifestSourceDigest === probe.manifestSourceDigest
    && ownership.tokenSha256 === expected.tokenSha256
    && Boolean(ownership.startedAt)
    && ownership.startedAt === probe.startedAt
  );
}

/**
 * Fallback for an in-place Desktop upgrade from a release that predates the
 * current ownership record. The caller must only invoke this after an
 * authenticated /api/meta response; this pure predicate then constrains the
 * replacement to the exact bundled executable path, a real listener PID, and
 * a release identity. It cannot match an arbitrary loopback service.
 */
export function authenticatedBundledBackendMatches(
  probe: BackendProbeIdentity,
  expected: ExpectedBundledBackendExecutable
): boolean {
  return (
    probe.occupied === true
    && probe.authenticated === true
    && Number.isInteger(probe.pid)
    && Number(probe.pid) > 0
    && Boolean(probe.executable)
    && probe.executable?.toLowerCase() === expected.executable.toLowerCase()
    && Boolean(probe.manifestSourceDigest)
    && Boolean(probe.startedAt)
  );
}

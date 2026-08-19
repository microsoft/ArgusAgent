import type { ProjectRow } from './api.js';
import {
  projectsForLaunchCwd,
  rankProjects,
  resolveProjectSelection,
  type ProjectSelection,
} from '../../core/src/projects.js';

export function initialProjectSelection(
  projects: ProjectRow[],
  requested?: string,
): ProjectSelection {
  return resolveProjectSelection(projects, requested);
}

export type InteractiveStartup =
  | { kind: 'fresh' }
  | { kind: 'pick' }
  | { kind: 'resume'; project: string };

/**
 * A plain interactive ``argus`` launch is a new conversation, never an
 * implicit resume of whichever daemon happened to be active most recently.
 * Resuming is explicit via ``--project`` at launch or ``/resume`` in-app.
 */
export function interactiveStartup(requested?: string, pick = false): InteractiveStartup {
  const project = requested?.trim() || '';
  if (project) return { kind: 'resume', project };
  return pick ? { kind: 'pick' } : { kind: 'fresh' };
}

/**
 * Running sessions which already own this launch directory, in the same
 * live/name/recency order used by the navigation surfaces. A plain `argus`
 * launch must attach to the first row instead of creating a second executor
 * which can only collide with the existing workspace lease.
 */
export function liveProjectsForLaunchCwd(
  projects: ProjectRow[],
  launchCwd: string,
): ProjectRow[] {
  return rankProjects(
    projectsForLaunchCwd(projects, launchCwd).filter((project) => project.daemon_alive),
  );
}

/** Backward-compatible convenience for callers that only need the ID. */
export function initialProjectId(projects: ProjectRow[], requested?: string): string | null {
  return initialProjectSelection(projects, requested).id;
}

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Literal

RunnerBackend = Literal["codex", "claude", "copilot", "opencode", "pi", "grok", "qoder", "dsh"]

BACKEND_CODEX: RunnerBackend = "codex"
BACKEND_CLAUDE: RunnerBackend = "claude"
BACKEND_COPILOT: RunnerBackend = "copilot"
BACKEND_OPENCODE: RunnerBackend = "opencode"
BACKEND_PI: RunnerBackend = "pi"
BACKEND_GROK: RunnerBackend = "grok"
BACKEND_QODER: RunnerBackend = "qoder"
BACKEND_DSH: RunnerBackend = "dsh"
DEFAULT_RUNNER_BACKEND: RunnerBackend = BACKEND_CODEX

# Qoder's official CLI (``qodercli``) is a Claude Code fork: it accepts the same
# headless argv (``-p --output-format stream-json --model … --permission-mode …
# --resume …``) and emits the same stream-json event schema. So ``qoder`` reuses
# the ``claude`` command builder, event consumer, sandbox policy, and prompt
# delivery verbatim. This family set is the single source of truth for "treat it
# like claude" so those call sites never drift apart.
CLAUDE_FAMILY: frozenset[str] = frozenset({BACKEND_CLAUDE, BACKEND_QODER})


def normalize_runner_backend(raw: str | None) -> RunnerBackend:
    value = str(raw or "").strip().lower()
    if value == BACKEND_CLAUDE:
        return BACKEND_CLAUDE
    if value == BACKEND_COPILOT:
        return BACKEND_COPILOT
    if value in (BACKEND_OPENCODE, "opencod"):
        return BACKEND_OPENCODE
    if value == BACKEND_PI:
        return BACKEND_PI
    if value == BACKEND_GROK:
        return BACKEND_GROK
    if value == BACKEND_QODER:
        return BACKEND_QODER
    if value == BACKEND_DSH:
        return BACKEND_DSH
    return BACKEND_CODEX


def default_runner_bin(backend: RunnerBackend) -> str:
    if backend == BACKEND_CLAUDE:
        return "claude"
    if backend == BACKEND_COPILOT:
        return "copilot"
    if backend == BACKEND_OPENCODE:
        return "opencode"
    if backend == BACKEND_PI:
        return "pi"
    if backend == BACKEND_GROK:
        return "grok"
    if backend == BACKEND_QODER:
        return "qodercli"
    if backend == BACKEND_DSH:
        return "dsh"
    return "codex"


def _resolve_explicit_candidate(candidate: Path) -> str | None:
    # Test fixtures, portable shims, and some user-local launchers are valid
    # extensionless files even on Windows. ``shutil.which`` applies PATHEXT and
    # can miss those exact candidates, so honor an explicitly located file
    # before probing sibling .exe/.cmd variants.
    try:
        is_file = candidate.is_file()
    except OSError:
        # PATH can contain an inaccessible launcher owned by another user.
        # Treat that entry as unavailable instead of breaking discovery for
        # every backend that appears later on PATH.
        return None
    if is_file and (os.name == "nt" or os.access(candidate, os.X_OK)):
        return str(candidate)
    resolved = shutil.which(str(candidate))
    if resolved:
        return resolved
    if os.name != "nt" or candidate.suffix:
        return None
    extensions = os.environ.get("PATHEXT", ".COM;.EXE;.BAT;.CMD").split(os.pathsep)
    wanted = {f"{candidate.name}{extension}".casefold() for extension in extensions if extension}
    try:
        for entry in candidate.parent.iterdir():
            if entry.is_file() and entry.name.casefold() in wanted:
                return str(entry)
    except OSError:
        return None
    return None


def resolve_runner_bin(
    backend: RunnerBackend | str | None,
    configured: str | None = None,
) -> str | None:
    """Resolve a CLI independently of service-manager PATH omissions."""
    chosen = normalize_runner_backend(backend)
    requested = str(configured or default_runner_bin(chosen)).strip()
    if not requested:
        return None
    expanded = str(Path(requested).expanduser())
    resolved = shutil.which(expanded)
    if resolved:
        return resolved
    if Path(expanded).parent != Path("."):
        return None
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        if not entry:
            continue
        resolved = _resolve_explicit_candidate(Path(entry) / expanded)
        if resolved:
            return resolved
    if chosen == BACKEND_OPENCODE:
        opencode_home = Path.home() / ".opencode" / "bin" / expanded
        resolved = _resolve_explicit_candidate(opencode_home)
        if resolved:
            return resolved
    if chosen == BACKEND_DSH:
        # dsh is installed through the nvm-managed Node toolchain, whose bin
        # directory is absent from non-interactive PATHs (the daemon may be
        # started from one). Probe the per-version nvm bins newest-first.
        nvm_versions = Path.home() / ".nvm" / "versions" / "node"
        if nvm_versions.is_dir():
            for version_dir in sorted(nvm_versions.iterdir(), reverse=True):
                candidate = version_dir / "bin" / expanded
                if candidate.is_file() and os.access(candidate, os.X_OK):
                    return str(candidate)
    user_local = Path.home() / ".local" / "bin" / expanded
    resolved = _resolve_explicit_candidate(user_local)
    if resolved:
        return resolved
    return None


def resolve_available_runner(
    backend: RunnerBackend | str | None,
    configured: str | None = None,
) -> tuple[RunnerBackend, str]:
    """Resolve the requested CLI, falling back only when Codex is absent."""
    raw = str(backend or "").strip().lower()
    chosen = normalize_runner_backend(backend)
    resolved = resolve_runner_bin(chosen, configured)
    if resolved:
        return chosen, resolved
    if chosen == BACKEND_CODEX and raw in ("", BACKEND_CODEX):
        copilot = resolve_runner_bin(BACKEND_COPILOT)
        if copilot:
            return BACKEND_COPILOT, copilot
    return chosen, str(configured or default_runner_bin(chosen)).strip()

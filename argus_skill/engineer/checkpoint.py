"""The ordinary Markdown checkpoint shared by fresh Engineer/Reviewer turns."""

from __future__ import annotations

from pathlib import Path


def resolve_shared_checkpoint(path: Path | None) -> Path | None:
    """Resolve the optional handoff path without creating it."""
    if path is None:
        return None
    return Path(path).expanduser().resolve()


def shared_checkpoint_instructions(
    path: Path | None,
    *,
    role: str,
    continuation: bool = True,
) -> str:
    """Tell one role how to take its turn editing the shared note."""
    if path is None:
        return ""
    checkpoint = str(Path(path).expanduser().resolve())
    if role == "reviewer" and not continuation:
        return (
            "## Shared checkpoint\n"
            f"If your verdict is not `done`, update `{checkpoint}` with only the "
            "remaining state, blocker, and next action before returning. For a "
            "`done` verdict, do not read or edit the checkpoint merely for ceremony."
        )
    packet = str(Path(path).expanduser().resolve().parent / "latest.json")
    if role == "reviewer":
        action = (
            "The Engineer already edited it this round. Verify against artifacts, "
            "then directly correct it before your verdict; you are the final editor."
        )
    else:
        action = (
            "Read it if it exists; create or update it only when another round needs "
            "current state, evidence paths, blockers, or a next action."
        )
    return (
        "## Shared checkpoint — edit the file directly using these exact absolute paths\n"
        f"Canonical context packet: `{packet}`\n"
        f"Human-editable projection: `{checkpoint}`\n\n"
        "Use these absolute paths verbatim for every read and edit. Never create or "
        "use a relative `state/`, `handoffs/`, `latest.json`, or `CHECKPOINT.md` "
        "copy inside the worktree; such a copy is not runtime state.\n\n"
        "Read the index first. If its `kind` is `mission_context`, the immutable "
        "objective/acceptance contract is inline because no role handoff exists "
        "yet. If its `kind` is `handoff_ref`, open `handoff.path` for the latest "
        "sealed role decision and `mission.path` for the immutable contract. Open "
        "only referenced artifacts unless new evidence requires expanding the "
        "search.\n\n"
        f"{action}\n\n"
        "It is current state, not a log: rewrite stale text. Actually edit the file; "
        "do not duplicate the verdict rationale or next-round instruction here; do "
        "not emit checkpoint JSON or merely describe an edit."
    )


__all__ = [
    "resolve_shared_checkpoint",
    "shared_checkpoint_instructions",
]

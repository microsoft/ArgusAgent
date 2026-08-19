"""Structural evidence index for materials execution, validation, and reports."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

EVIDENCE_RELPATH = Path("research/MATERIALS_EVIDENCE.json")
EVIDENCE_KINDS = frozenset({
    "source",
    "input",
    "code",
    "native_output",
    "run_log",
    "analysis",
    "experimental_record",
    "validation",
    "report",
    "blocker",
    "safety_record",
})
_REQUIRED_KINDS = {
    "execute": ({"native_output", "run_log", "analysis", "experimental_record", "blocker"},),
    "validate": ({"validation", "blocker"},),
    "report": (
        {"report"},
        {"native_output", "run_log", "analysis", "experimental_record", "blocker"},
        {"validation", "blocker"},
    ),
}


def _inside(root: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(root)
        return True
    except ValueError:
        return False


def validate_evidence(project_root: object, stage: str) -> list[str]:
    """Validate indexed evidence paths without judging scientific content."""
    root = Path(str(project_root or ".")).resolve()
    stage_name = (stage or "").strip().lower()
    if stage_name not in _REQUIRED_KINDS:
        return [f"unsupported materials evidence stage: {stage_name!r}"]
    manifest = root / EVIDENCE_RELPATH
    try:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"missing {EVIDENCE_RELPATH.as_posix()}"]
    except (OSError, json.JSONDecodeError) as exc:
        return [f"invalid {EVIDENCE_RELPATH.as_posix()}: {exc}"]
    if not isinstance(payload, dict) or payload.get("version") != 1:
        return [f"{EVIDENCE_RELPATH.as_posix()} must declare version 1"]
    entries = payload.get("evidence")
    if not isinstance(entries, list) or not entries:
        return [f"{EVIDENCE_RELPATH.as_posix()} must contain a non-empty evidence list"]

    issues: list[str] = []
    present_kinds: set[str] = set()
    seen_paths: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            issues.append(f"evidence[{index}] must be an object")
            continue
        kind = str(entry.get("kind") or "").strip().lower()
        relpath = str(entry.get("path") or "").strip()
        if kind not in EVIDENCE_KINDS:
            issues.append(f"evidence[{index}] has unsupported kind {kind!r}")
        else:
            present_kinds.add(kind)
        if not relpath:
            issues.append(f"evidence[{index}] has no path")
            continue
        if relpath in seen_paths:
            issues.append(f"evidence[{index}] repeats path {relpath!r}")
            continue
        seen_paths.add(relpath)
        raw_path = Path(relpath)
        if raw_path.is_absolute() or ".." in raw_path.parts:
            issues.append(f"evidence[{index}] path must stay project-relative: {relpath!r}")
            continue
        try:
            candidate = (root / raw_path).resolve(strict=True)
        except OSError:
            issues.append(f"evidence[{index}] path does not exist: {relpath!r}")
            continue
        if not _inside(root, candidate):
            issues.append(f"evidence[{index}] path escapes the project: {relpath!r}")
        elif not candidate.is_file():
            issues.append(f"evidence[{index}] path is not a file: {relpath!r}")
        elif candidate.stat().st_size <= 0:
            issues.append(f"evidence[{index}] path is empty: {relpath!r}")

    for accepted in _REQUIRED_KINDS[stage_name]:
        if not present_kinds.intersection(accepted):
            issues.append(
                f"{stage_name} requires evidence kind in: {', '.join(sorted(accepted))}"
            )
    return issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="materials-evidence")
    parser.add_argument("command", choices=["check"], nargs="?", default="check")
    parser.add_argument("--project-root", default=".")
    parser.add_argument("--stage", choices=sorted(_REQUIRED_KINDS), required=True)
    args = parser.parse_args(argv)
    issues = validate_evidence(args.project_root, args.stage)
    if issues:
        for issue in issues:
            print(f"ERROR: {issue}", file=sys.stderr)
        return 1
    print(f"materials evidence valid for {args.stage}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
from __future__ import annotations

import argparse
import fnmatch
import subprocess
from pathlib import Path
from typing import Iterable, Sequence

PRIVATE_ONLY_PATTERNS = (
    ".github/workflows/private-public-parity.yml",
    "ARGUS_IMPRESSIVE_RESULTS.md",
    "ARGUS_IMPRESSIVE_RESULTS.zh-CN.md",
    "PRIVATE_TODO.md",
    "PRIVATE_TODO.zh-CN.md",
    "docs/RESEARCH_AGENCY_AND_VERIFICATION_TODO.md",
    "docs/evaluations/**",
    "technical_report/**",
    "tests/test_operator_output_examples.py",
)


def is_private_only(path: str, patterns: Iterable[str] = PRIVATE_ONLY_PATTERNS) -> bool:
    normalized = path.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return any(fnmatch.fnmatchcase(normalized, pattern) for pattern in patterns)


def unexpected_differences(
    paths: Iterable[str],
    patterns: Iterable[str] = PRIVATE_ONLY_PATTERNS,
) -> list[str]:
    return sorted({
        path.replace("\\", "/").strip()
        for path in paths
        if path.strip() and not is_private_only(path, patterns)
    })


def changed_paths(
    repo_root: Path,
    *,
    private_ref: str,
    public_ref: str,
) -> list[str]:
    completed = subprocess.run(
        [
            "git",
            "-C",
            str(repo_root),
            "diff",
            "--name-only",
            "--no-renames",
            public_ref,
            private_ref,
            "--",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in completed.stdout.splitlines() if line.strip()]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fail when private/public product trees differ outside the allowlist.",
    )
    parser.add_argument("--private-ref", default="HEAD")
    parser.add_argument("--public-ref", default="public/main")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    differences = unexpected_differences(
        changed_paths(
            args.repo_root,
            private_ref=args.private_ref,
            public_ref=args.public_ref,
        )
    )
    if not differences:
        print("private/public product trees match")
        return 0
    print("unexpected private/public differences:")
    for path in differences:
        print(f"  {path}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

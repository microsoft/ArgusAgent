"""Run the decidable integrity checks over a paper project.

Two checks that the stage checklists currently describe in prose and leave to
the agent to perform by hand:

``citations``
    ``run.score_variance`` aside, the bibliography rules — every cited key
    resolves, every entry is complete and verified — were only ever enforced by
    asking. This resolves them against the actual ``.tex`` and ``.bib``.

``scores``
    ``run.score_variance`` asks the agent to run
    ``jq -r .score ... | sort -u | wc -l`` and interpret the number. Same check,
    except a non-zero exit cannot be talked past.

Neither replaces the reviewer. They settle the mechanical half so the reviewer
spends its attention on the half that needs judgement — whether the entry
describes the paper it claims to, whether the scorer measures the right thing.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .integrity_gate import IntegrityIssue, citation_integrity, scorer_integrity

__all__ = ["check_citations", "check_scores", "main"]


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def check_citations(project_root: Path, *, require_all_cited: bool = False) -> list[IntegrityIssue]:
    paper = project_root / "paper"
    root = paper if paper.is_dir() else project_root
    tex_sources = [_read(path) for path in sorted(root.rglob("*.tex"))]
    bib_source = "\n".join(_read(path) for path in sorted(root.rglob("*.bib")))
    if not tex_sources and not bib_source:
        return []
    return citation_integrity(
        tex_sources, bib_source, require_all_entries_cited=require_all_cited
    )


def _scores_in(path: Path) -> list[float]:
    scores: list[float] = []
    for line in _read(path).splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        value = row.get("score") if isinstance(row, dict) else None
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            scores.append(float(value))
    return scores


def check_scores(project_root: Path, *, min_samples: int = 4) -> list[IntegrityIssue]:
    """Flag scored-row files whose scorer produced no distinguishable output.

    ``min_samples`` defaults to 4 to match the checklist's ">3 rows" wording:
    below that, identical scores are plausible rather than suspicious.
    """
    issues: list[IntegrityIssue] = []
    for path in sorted(project_root.rglob("scored_rows.jsonl")):
        scores = _scores_in(path)
        issues.extend(
            scorer_integrity(
                scores,
                min_samples=min_samples,
                label=str(path.relative_to(project_root)),
            )
        )
    return issues


def _report(issues: list[IntegrityIssue], subject: str) -> int:
    blockers = [issue for issue in issues if issue.blocking]
    for issue in issues:
        stream = sys.stderr if issue.blocking else sys.stdout
        prefix = "ERROR" if issue.blocking else "note"
        print(f"{prefix}: {issue.code}: {issue.message}", file=stream)
    if blockers:
        return 2
    print(f"{subject}: no blocking integrity issues")
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    citations = sub.add_parser("citations")
    citations.add_argument("--project-root", type=Path, default=Path.cwd())
    citations.add_argument(
        "--require-all-cited",
        action="store_true",
        help="also report entries that are never cited (advisory)",
    )
    scores = sub.add_parser("scores")
    scores.add_argument("--project-root", type=Path, default=Path.cwd())
    scores.add_argument("--min-samples", type=int, default=4)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    root = Path(args.project_root)
    if args.command == "citations":
        return _report(
            check_citations(root, require_all_cited=args.require_all_cited), "citations"
        )
    return _report(check_scores(root, min_samples=args.min_samples), "scored rows")


if __name__ == "__main__":
    raise SystemExit(main())

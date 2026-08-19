"""Integrity checks a machine can actually decide.

The integrity floor — no fabricated evidence, no stub evaluators, no invented
citations — is currently enforced by asking a model to check itself. That is
the wrong place for the parts that are decidable. Whether ``\\cite{smith2024}``
resolves to an entry in the ``.bib`` is not a judgement call; whether a scorer
returned the same number for every input is not a judgement call. Rules like
these belong in code, where they hold regardless of what a prompt says or how
much context the reviewer had left.

This matters most when verification strength becomes tunable. An ``explore``
profile that relaxes *what must be delivered* is reasonable; an ``explore``
profile that relaxes *whether the evidence is real* is not. Moving the
decidable floor into code is what makes that distinction enforceable rather
than aspirational.

**Deliberately out of scope.** Semantic correctness stays with the reviewer.
Whether ``amem2025`` actually names the paper its title claims, whether a
baseline is the strongest available, whether a metric measures what it says —
none of that is decidable from the text, and pretending otherwise would trade
a real check for a fake one.
"""
from __future__ import annotations

import re
import statistics
from dataclasses import dataclass
from typing import Iterable, Sequence

__all__ = [
    "BIB_REQUIRED_FIELDS",
    "IntegrityIssue",
    "bib_entries",
    "cited_keys",
    "citation_integrity",
    "scorer_integrity",
]

#: Fields without which a reference cannot be checked by a reader.
BIB_REQUIRED_FIELDS: tuple[str, ...] = ("author", "title", "year")

#: Markers a drafting pass leaves behind and a final paper must not contain.
_UNVERIFIED_MARKERS = (
    "VERIFY_CITATION",
    "UNVERIFIED",
    "PLACEHOLDER",
    "REPLACE",
    "TODO",
    "TBD",
    "FIXME",
)

#: `author = {Smith and others}` renders as "and 1 others" — a truncation
#: artifact, not a real author list.
_AUTHOR_PLACEHOLDER_RE = re.compile(
    r"\b(and\s+others|et\s+al\.?)\s*$", re.IGNORECASE
)

_CITE_RE = re.compile(r"\\[a-zA-Z]*cite[a-zA-Z]*\s*(?:\[[^\]]*\]\s*)*\{([^}]*)\}")
_ENTRY_RE = re.compile(r"@(\w+)\s*\{\s*([^,\s}]+)\s*,", re.MULTILINE)
_COMMENT_RE = re.compile(r"(?<!\\)%.*?$", re.MULTILINE)


@dataclass(frozen=True)
class IntegrityIssue:
    """One decidable violation, with the evidence that decided it."""

    code: str
    severity: str  # "blocker" | "advisory"
    message: str
    subject: str = ""

    @property
    def blocking(self) -> bool:
        return self.severity == "blocker"


# ---------------------------------------------------------------------------
# Citations
# ---------------------------------------------------------------------------

def _strip_comments(text: str) -> str:
    """Drop LaTeX comments so commented-out citations are not counted."""
    return _COMMENT_RE.sub("", text)


def cited_keys(*tex_sources: str) -> list[str]:
    """Every key referenced by a ``\\cite``-family command, in first-seen order."""
    found: list[str] = []
    seen: set[str] = set()
    for source in tex_sources:
        for group in _CITE_RE.findall(_strip_comments(source)):
            for raw in group.split(","):
                key = raw.strip()
                if key and key not in seen:
                    seen.add(key)
                    found.append(key)
    return found


def _entry_body(text: str, start: int) -> str:
    """Text of one BibTeX entry, matched by counting braces."""
    depth = 0
    for index in range(start, len(text)):
        char = text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return text[start:]


def _entry_fields(body: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for match in re.finditer(r"(\w+)\s*=\s*", body):
        name = match.group(1).lower()
        rest = body[match.end() :].lstrip()
        if not rest:
            continue
        if rest[0] in "{\"":
            closer = "}" if rest[0] == "{" else '"'
            depth = 0
            for index, char in enumerate(rest):
                if char == "{" or (closer == '"' and index == 0):
                    depth += 1
                elif char == closer:
                    depth -= 1
                    if depth == 0:
                        fields.setdefault(name, rest[1:index])
                        break
        else:
            fields.setdefault(name, rest.split(",", 1)[0].strip())
    return fields


def bib_entries(bib_source: str) -> dict[str, dict[str, str]]:
    """Parse ``key -> fields``. Later duplicates do not overwrite earlier ones."""
    entries: dict[str, dict[str, str]] = {}
    text = _strip_comments(bib_source)
    for match in _ENTRY_RE.finditer(text):
        entry_type = match.group(1).lower()
        if entry_type in {"comment", "preamble", "string"}:
            continue
        key = match.group(2).strip()
        brace = text.find("{", match.start())
        body = _entry_body(text, brace)
        entries.setdefault(key, _entry_fields(body))
    return entries


def _duplicate_keys(bib_source: str) -> list[str]:
    counts: dict[str, int] = {}
    text = _strip_comments(bib_source)
    for match in _ENTRY_RE.finditer(text):
        if match.group(1).lower() in {"comment", "preamble", "string"}:
            continue
        key = match.group(2).strip()
        counts[key] = counts.get(key, 0) + 1
    return sorted(key for key, count in counts.items() if count > 1)


def citation_integrity(
    tex_sources: Sequence[str],
    bib_source: str,
    *,
    require_all_entries_cited: bool = False,
) -> list[IntegrityIssue]:
    """Decidable citation problems, blockers first.

    Checks only what the text settles: does every cited key resolve, does every
    entry carry the fields a reader needs, is anything still marked unverified.
    It says nothing about whether an entry describes the paper it claims to —
    that remains the reviewer's job.
    """
    issues: list[IntegrityIssue] = []
    entries = bib_entries(bib_source)
    keys = cited_keys(*tex_sources)

    for key in keys:
        if key not in entries:
            issues.append(
                IntegrityIssue(
                    "unresolved_citation",
                    "blocker",
                    f"\\cite{{{key}}} has no entry in the bibliography; the citation "
                    "does not resolve and will render as a broken reference",
                    key,
                )
            )

    for key in _duplicate_keys(bib_source):
        issues.append(
            IntegrityIssue(
                "duplicate_bib_key",
                "blocker",
                f"bibliography defines {key!r} more than once; which entry renders "
                "is undefined",
                key,
            )
        )

    for key, fields in sorted(entries.items()):
        for field in BIB_REQUIRED_FIELDS:
            if not fields.get(field, "").strip():
                issues.append(
                    IntegrityIssue(
                        "incomplete_bib_entry",
                        "blocker",
                        f"{key} is missing {field}; the reference cannot be looked up",
                        key,
                    )
                )
        author = fields.get("author", "")
        if author and _AUTHOR_PLACEHOLDER_RE.search(author.strip()):
            issues.append(
                IntegrityIssue(
                    "truncated_author_list",
                    "blocker",
                    f"{key} ends its author list with a placeholder; this renders as "
                    '"and N others" instead of the real authors',
                    key,
                )
            )
        blob = " ".join(fields.values()).upper()
        for marker in _UNVERIFIED_MARKERS:
            if marker in blob:
                issues.append(
                    IntegrityIssue(
                        "unverified_bib_entry",
                        "blocker",
                        f"{key} still carries the {marker} marker; it was never verified",
                        key,
                    )
                )
                break

    if require_all_entries_cited:
        cited = set(keys)
        for key in sorted(set(entries) - cited):
            issues.append(
                IntegrityIssue(
                    "uncited_bib_entry",
                    "advisory",
                    f"{key} is in the bibliography but never cited; padding a "
                    "reference list does not strengthen a paper",
                    key,
                )
            )

    issues.sort(key=lambda issue: (not issue.blocking, issue.code, issue.subject))
    return issues


# ---------------------------------------------------------------------------
# Scorers
# ---------------------------------------------------------------------------

def scorer_integrity(
    scores: Iterable[float],
    *,
    min_samples: int = 3,
    tolerance: float = 1e-12,
    label: str = "scorer",
) -> list[IntegrityIssue]:
    """Detect a scorer that cannot distinguish anything.

    A constant scorer produces a clean-looking evaluation in which every
    result is identical — which reads as a stable measurement rather than as a
    broken one. Below ``min_samples`` no conclusion is drawn: two equal scores
    are a coincidence, not a pattern.
    """
    values = [float(score) for score in scores]
    if len(values) < min_samples:
        return []

    spread = max(values) - min(values)
    if spread <= tolerance:
        return [
            IntegrityIssue(
                "constant_scorer",
                "blocker",
                f"{label} returned {values[0]!r} for all {len(values)} samples; a "
                "scorer with no discriminating power cannot support any comparison",
                label,
            )
        ]
    if statistics.pstdev(values) <= tolerance:
        return [
            IntegrityIssue(
                "degenerate_scorer",
                "blocker",
                f"{label} has zero variance across {len(values)} samples despite "
                "differing inputs; the measurement is not responding to the input",
                label,
            )
        ]
    return []

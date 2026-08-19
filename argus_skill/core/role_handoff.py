"""Structured role handoff parsing for model-authored round summaries."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from .operator_decision import parse_agent_operator_options

HandoffOwner = Literal["engineer", "reviewer", "operator"]

_EMPTY_VALUES = frozenset({"", "none", "n/a", "na", "null"})
_REVIEW_ACTION_RE = re.compile(
    r"\b(?:invoke|request|run|perform|start|proceed(?:\s+with)?|send(?:\s+to)?)\b"
    r".{0,80}\b(?:independent|hostile|adversarial)?\s*review(?:er)?\b"
    r"|\b(?:independent|hostile|adversarial)\s+review(?:er)?\b.{0,80}"
    r"\b(?:invoke|request|run|perform|start|proceed)\b",
    re.IGNORECASE,
)
_OPERATOR_AUTHORITY_RE = re.compile(
    r"\b(?:permission|authorization|authorize|authorized|approval|approve|consent|"
    r"confirmation|credential|access|secret|budget|purchase|pay|"
    r"publish|release|deploy|production|external\s+publication|irreversible|"
    r"delete|destructive|change\s+(?:the\s+)?(?:goal|objective|scope|target)|"
    r"business\s+decision|product\s+decision)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class EngineerHandoff:
    """The next role and any genuine operator decision requested by Engineer."""

    next_owner: HandoffOwner
    operator_question: str = ""
    operator_options: tuple[dict, ...] = ()
    source: str = "default"

    @property
    def waits_for_operator(self) -> bool:
        return self.next_owner == "operator" and bool(self.operator_question)


def _named_value(message: str, name: str, *, limit: int = 500) -> str:
    value = ""
    expected = name.casefold()
    for line in str(message or "").splitlines():
        normalized_line = line.strip()
        if (
            len(normalized_line) >= 2
            and normalized_line.startswith("`")
            and normalized_line.endswith("`")
        ):
            normalized_line = normalized_line[1:-1].strip()
        key, separator, candidate = normalized_line.partition("=")
        if separator and key.strip().casefold() == expected:
            normalized = candidate.strip()
            value = "" if normalized.casefold().rstrip(".") in _EMPTY_VALUES else normalized[:limit]
    return value


def _runtime_owned_review_request(question: str, options: list[dict]) -> bool:
    """Recognize legacy Reviewer requests that predate ``NEXT_OWNER``.

    This is intentionally a narrow migration path. Structured ``NEXT_OWNER`` is
    authoritative for new turns, while requests mentioning operator-owned
    authority can never be auto-promoted to Reviewer.
    """

    text = "\n".join(
        [
            question,
            *(
                f"{option.get('label', '')} {option.get('description', '')}"
                for option in options
            ),
        ]
    )
    return bool(_REVIEW_ACTION_RE.search(text)) and not _OPERATOR_AUTHORITY_RE.search(text)


def parse_engineer_handoff(message: str) -> EngineerHandoff:
    question = _named_value(message, "OPERATOR_QUESTION")
    options = parse_agent_operator_options(message)
    declared_owner = _named_value(message, "NEXT_OWNER", limit=32).casefold()

    if declared_owner == "operator" and question:
        return EngineerHandoff(
            "operator",
            operator_question=question,
            operator_options=tuple(options),
            source="structured",
        )
    if declared_owner == "reviewer" and (
        not question or _runtime_owned_review_request(question, options)
    ):
        return EngineerHandoff("reviewer", source="structured")
    if declared_owner == "engineer" and not question:
        return EngineerHandoff("engineer", source="structured")
    if not declared_owner and question and _runtime_owned_review_request(question, options):
        return EngineerHandoff("reviewer", source="legacy_reviewer_request")
    if question:
        return EngineerHandoff(
            "operator",
            operator_question=question,
            operator_options=tuple(options),
            source="operator_question",
        )
    return EngineerHandoff("reviewer", source="default")


__all__ = ["EngineerHandoff", "HandoffOwner", "parse_engineer_handoff"]

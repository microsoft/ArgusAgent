"""Explicit shared contract surface for four-stage metric optimization."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

OPTIMIZATION_STAGE_ORDER = ("setup", "optimize", "measure", "report")
PIPELINE_CHECK = (
    "Pipeline state present",
    "test -f .argus/PIPELINE_STATE.json",
)


@dataclass(frozen=True)
class OptimizationBaseContract:
    stage_order: tuple[str, ...]
    stage_checks: dict[str, list[tuple[str, str]]]
    reviewer_checklists: dict[str, Any]
    checklist_items: dict[str, Any]


def speedrun_base_contract() -> OptimizationBaseContract:
    """Return independent containers for a speedrun-compatible specialization."""
    from .speedrun import stages

    return OptimizationBaseContract(
        stage_order=OPTIMIZATION_STAGE_ORDER,
        stage_checks={stage: list(checks) for stage, checks in stages.STAGE_CHECKS.items()},
        reviewer_checklists=dict(stages.REVIEWER_CHECKLISTS),
        checklist_items=dict(stages.CHECKLIST_ITEMS),
    )


__all__ = [
    "OPTIMIZATION_STAGE_ORDER",
    "OptimizationBaseContract",
    "PIPELINE_CHECK",
    "speedrun_base_contract",
]
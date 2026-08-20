from __future__ import annotations

from pathlib import Path

import pytest

from argus_skill.life.supervisor._helpers import _resolve_task_dep_ids
from argus_skill.life.supervisor._planning_cycle_enqueue import (
    PlanningCycleEnqueueMixin,
    _apply_planner_stage_request,
)


def test_resolve_dep_ids_maps_local_keys() -> None:
    resolved, unresolved = _resolve_task_dep_ids(
        ["a", "b"],
        {"a": "id-a", "b": "id-b"},
    )
    assert resolved == ["id-a", "id-b"]
    assert unresolved == []


def test_resolve_dep_ids_empty_deps_is_flat() -> None:
    assert _resolve_task_dep_ids([], {"a": "id-a"}) == ([], [])


def test_resolve_dep_ids_reports_unknown_keys() -> None:
    resolved, unresolved = _resolve_task_dep_ids(
        ["a", "ghost"],
        {"a": "id-a"},
    )
    assert resolved == ["id-a"]
    assert unresolved == ["ghost"]


def test_resolve_dep_ids_dedupes_preserving_order() -> None:
    resolved, unresolved = _resolve_task_dep_ids(
        ["a", "b", "a"],
        {"a": "id-a", "b": "id-b"},
    )
    assert resolved == ["id-a", "id-b"]
    assert unresolved == []


def test_planner_task_inherits_manager_routing_without_optional_fields() -> None:
    assert PlanningCycleEnqueueMixin._manager_decision_evidence({}) == {
        "routed": True,
    }


def test_planner_stage_request_rolls_back_an_earlier_target(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    from argus_skill.skills import stage_machine

    calls: list[dict[str, object]] = []

    monkeypatch.setattr(stage_machine, "current_stage", lambda _root: "submission")

    def reject_advance(*_args, **_kwargs) -> None:
        raise ValueError("advance target 'run' must be later than 'submission'")

    def record_rollback(*args, **kwargs) -> str:
        calls.append({"args": args, "kwargs": kwargs})
        return str(tmp_path / "PIPELINE_STATE.json")

    monkeypatch.setattr(stage_machine, "advance_stage", reject_advance)
    monkeypatch.setattr(stage_machine, "rollback_stage", record_rollback)

    _apply_planner_stage_request(
        state_root=tmp_path,
        requested_stage="run",
        reason="Reviewer found missing claim-bearing run evidence.",
        evidence_root=tmp_path,
    )

    assert calls == [{
        "args": (tmp_path,),
        "kwargs": {
            "target_stage": "run",
            "reason": "Reviewer found missing claim-bearing run evidence.",
            "rolled_back_by": "manager:planner_request",
            "evidence_root": tmp_path,
        },
    }]

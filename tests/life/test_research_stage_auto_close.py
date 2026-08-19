from __future__ import annotations

from pathlib import Path

from argus_skill.life.supervisor import _planning_cycle_enqueue as module


def test_research_stage_ready_when_deterministic_blockers_are_empty(
    tmp_path: Path,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "argus_skill.core.pipeline_state.read_pipeline_state",
        lambda _root: {"vertical": "research", "current_stage": "research"},
    )
    definition = object()
    monkeypatch.setattr(
        "argus_skill.verticals._base.load_vertical",
        lambda *_args, **_kwargs: definition,
    )
    monkeypatch.setattr(
        "argus_skill.verticals._base.vertical_stage_completion_issues",
        lambda *_args, **_kwargs: (),
    )

    assert module._research_stage_ready_for_close(
        state_root=tmp_path / "state",
        evidence_root=tmp_path / "workdir",
    )


def test_research_stage_does_not_close_with_blockers(
    tmp_path: Path,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "argus_skill.core.pipeline_state.read_pipeline_state",
        lambda _root: {"vertical": "research", "current_stage": "research"},
    )
    monkeypatch.setattr(
        "argus_skill.verticals._base.load_vertical",
        lambda *_args, **_kwargs: object(),
    )
    monkeypatch.setattr(
        "argus_skill.verticals._base.vertical_stage_completion_issues",
        lambda *_args, **_kwargs: ("selection incomplete",),
    )

    assert not module._research_stage_ready_for_close(
        state_root=tmp_path / "state",
        evidence_root=tmp_path / "workdir",
    )

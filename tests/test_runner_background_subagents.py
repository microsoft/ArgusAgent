from __future__ import annotations

import json
import os
from pathlib import Path

from argus_skill.engineer.external_work import parse_external_wait_request
from argus_skill.engineer.round_config import SupervisedConfig
from argus_skill.engineer.round_state import RoundLoopState
from argus_skill.engineer.round_waits import RoundWaitsMixin


def test_subagent_wait_uses_structured_request() -> None:
    assert parse_external_wait_request(
        '{"wait_for": "subagent", "wait_id": "task-123"}'
    ) == ("subagent", "task-123")


def test_external_work_wait_uses_structured_request() -> None:
    assert parse_external_wait_request(
        '{"wait_for": "external_work", "wait_id": "work-123"}'
    ) == ("external_work", "work-123")


def test_incomplete_json_is_not_a_wait_request() -> None:
    assert parse_external_wait_request('"wait_for": "subagent"') is None


def test_healthy_subagent_wait_does_not_consume_cadence_rounds(
    tmp_path: Path,
    monkeypatch,
) -> None:
    registry = tmp_path / ".argus_subagents"
    registry.mkdir()
    (registry / "task-123.json").write_text(json.dumps({
        "task_id": "task-123",
        "state": "running",
        "mode": "direct",
        "pid": os.getpid(),
    }), encoding="utf-8")
    waits = iter([
        ("cadence_elapsed", 120.0),
        ("cadence_elapsed", 120.0),
        ("terminal", 15.0),
    ])
    calls: list[str] = []

    def wait_once(**kwargs):
        calls.append(kwargs["work_id"])
        return next(waits)

    from argus_skill.engineer import runner

    monkeypatch.setattr(runner, "_run_external_work_wait", wait_once)
    state = RoundLoopState()
    progress_at = state.last_decision_progress_at

    control = RoundWaitsMixin()._handle_agent_driven_wait(
        round_index=4,
        supervised_config=SupervisedConfig(max_rounds=4),
        raw_engineer_message=(
            '{"wait_for": "subagent", "wait_id": "task-123"}'
        ),
        workdir=tmp_path,
        state=state,
        on_event=None,
    )

    assert control.action == "continue_loop"
    assert calls == ["task-123", "task-123", "task-123"]
    assert state.last_decision_progress_at == progress_at + 255.0

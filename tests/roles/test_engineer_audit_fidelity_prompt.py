from __future__ import annotations

import pytest

from argus_skill.roles.prompts import engineer


@pytest.mark.parametrize("include_static", [True, False])
def test_audit_tasks_get_provenance_and_append_only_guards(
    monkeypatch: pytest.MonkeyPatch,
    include_static: bool,
) -> None:
    monkeypatch.setattr(engineer, "native_shell_contract", lambda: "")
    monkeypatch.setattr(engineer, "native_shell_summary", lambda: "")

    prompt = engineer.build_mission_prompt(
        task=(
            "Generate a paper and maintain an append-only issue ledger, "
            "COMMAND_LOG, process trace, and provenance audit."
        ),
        skill_text="",
        next_action=None,
        include_static=include_static,
    )

    assert "An objective or inherited summary is a requirement, not observed evidence" in prompt
    assert "label the claim unverified" in prompt
    assert "stop installs and repairs immediately" in prompt
    assert "never replace that file" in prompt
    assert "byte-faithfully in a sidecar" in prompt
    assert "unquoted heredoc" in prompt
    assert "inner stderr/status" in prompt


def test_ordinary_task_does_not_pay_audit_prompt_cost(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(engineer, "native_shell_contract", lambda: "")
    monkeypatch.setattr(engineer, "native_shell_summary", lambda: "")

    prompt = engineer.build_mission_prompt(
        task="Implement the parser fix and run its unit test.",
        skill_text="",
        next_action=None,
    )

    assert "## Audit fidelity" not in prompt

from __future__ import annotations

from argus_skill.roles.prompts.engineer import build_mission_prompt

_GROUNDING = (
    "\n\n## Manager project grounding (advisory evidence)\n"
    "Architecture: gateway -> runner. Verification: focused tests."
)


def test_identical_original_and_current_task_render_once() -> None:
    marker = "TOKEN_EFFICIENCY_OBJECTIVE_42"
    task = f"Audit {marker}."

    prompt = build_mission_prompt(
        task=task,
        original_request=task,
        skill_text="",
        next_action=None,
    )

    assert prompt.count(marker) == 1
    assert "## Original operator request" not in prompt


def test_shared_manager_grounding_renders_once_for_distinct_task_wording() -> None:
    prompt = build_mission_prompt(
        task="Canonical execution objective." + _GROUNDING,
        original_request="Operator wording." + _GROUNDING,
        skill_text="",
        next_action=None,
    )

    assert prompt.count("Manager project grounding") == 1
    assert prompt.count("gateway -> runner") == 1
    assert "Operator wording." in prompt
    assert "Canonical execution objective." in prompt


def test_engineer_prompt_forbids_repeated_checks_and_unbounded_tool_loops() -> None:
    prompt = build_mission_prompt(
        task="Audit the repository once.",
        skill_text="",
        next_action=None,
    )

    assert "Never repeat unchanged checks/reads" in prompt
    assert "never exceed 24" in prompt

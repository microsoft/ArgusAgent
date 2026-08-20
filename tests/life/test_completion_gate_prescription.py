"""Regression test: a prescriptive gate must state its prescription.

``_research_project_done_issue`` and ``_journal_has_final_certification`` both
read one journal entry, and ``_mission_execution_settlement`` writes it for
exactly one shape of mission: succeeded, ``item_scope == final_submission``,
certified by the Reviewer. Nothing else satisfies either gate.

The runtime note named that mechanism for ``final_certification_missing`` but
sent ``research_target_incomplete`` — the diagnostic the research verticals
actually hit — down the "harness does not prescribe a repair or delivery task"
branch, telling the Planner to use its judgement about a gate that accepts one
prescribed action and nothing else.

Observed live: testbed run 8 (s-fed750c2) spent missions 2, 3 and 4 guessing at
it, each independently reviewed ``done`` and each rejected with
``missing_exploratory_reviewer_certification``; run 9 (s-1828745c) instead
escalated into the self-maintenance subsystem and patched
``argus_skill/planner/planner.py``.

Citations:
- argus_skill/life/supervisor/_planning_context.py
  — ``_manager_planner_feedback_runtime_note``
- argus_skill/life/supervisor/_mission_execution_settlement.py
  — ``final_submission_certified``
"""

from __future__ import annotations

import pytest

from argus_skill.core.models import RunnerResult
from argus_skill.life.memory import LifeMemory
from argus_skill.life.supervisor import LifeBudget, LifeSupervisor, LifeSupervisorConfig
from argus_skill.life.supervisor._constants import PLAN_ERROR
from argus_skill.life.supervisor._planning_context import PlanningContextMixin

PRESCRIBED = "`TASK_SCOPE=final_submission`"


def _note(diagnostic: str, reason: str = "gate held") -> str:
    class Harness(PlanningContextMixin):
        def _load_manager_planner_feedback(self):
            return {
                "stage": "scope",
                "diagnostic": diagnostic,
                "attempts": 1,
                "reason": reason,
            }

    return Harness()._manager_planner_feedback_runtime_note()


@pytest.mark.parametrize(
    "diagnostic",
    ["final_certification_missing", "research_target_incomplete"],
)
def test_certification_gates_name_the_only_action_that_clears_them(
    diagnostic: str,
) -> None:
    note = _note(diagnostic)

    assert PRESCRIBED in note, (
        f"{diagnostic} is cleared only by a certified final_submission-scoped "
        "mission, but the note does not tell the Planner to author one"
    )
    assert "harness does not prescribe" not in note


def test_the_research_gate_says_bounded_scope_cannot_clear_it() -> None:
    """Run 8's four rejected missions were all complete, and all bounded."""
    note = _note(
        "research_target_incomplete",
        "Research project completion gate held: "
        "missing_exploratory_reviewer_certification.",
    )

    assert "bounded scope cannot satisfy this gate" in note


def test_unprescribed_diagnostics_still_leave_the_planner_its_judgement() -> None:
    """The prescription is a claim about two gates, not a blanket one."""
    note = _note("staged_goal_gate_incomplete")

    assert PRESCRIBED not in note
    assert "harness does not prescribe" in note


def test_no_feedback_means_no_note() -> None:
    class Harness(PlanningContextMixin):
        def _load_manager_planner_feedback(self):
            return None

    assert Harness()._manager_planner_feedback_runtime_note() == ""


def test_feedback_prescription_rejects_bounded_scope_task_before_enqueue(
    tmp_path,
    monkeypatch,
) -> None:
    class _Sink:
        def __init__(self) -> None:
            self.events = []

        def handle_event(self, event):
            self.events.append(event)

    class _Runner:
        def __init__(self) -> None:
            self.calls = 0

        def run_exec(self, **_kwargs):
            self.calls += 1
            return RunnerResult(
                exit_code=0,
                agent_messages=[
                    "\n".join(
                        [
                            "PROJECT_DONE=false",
                            "REASON=final certification remains",
                            "TASK_KEY=final-certification",
                            "TASK_TITLE=Make final certification host-visible",
                            (
                                "TASK_OBJECTIVE=Run Reviewer certification with "
                                "TASK_SCOPE=final_submission so the gate can consume it."
                            ),
                            "TASK_ACCEPTANCE_CHECK=Reviewer PASS is recorded.",
                        ]
                    )
                ],
                stdout_lines=[],
                stderr_lines=[],
                thread_id=None,
                fatal_error=None,
                input_tokens=0,
                cached_input_tokens=0,
                output_tokens=0,
            )

    sink = _Sink()
    planner_runner = _Runner()
    supervisor = LifeSupervisor(
        memory=LifeMemory.open(tmp_path / "life"),
        runner=object(),
        sink=sink,
        config=LifeSupervisorConfig(
            continuous=True,
            continuous_objective="complete final submission certification",
            budget=LifeBudget(max_missions=1),
            final_certification_gate=True,
            project_worktree=tmp_path,
            artifact_root=tmp_path,
        ),
        planner_runner=planner_runner,
    )
    monkeypatch.setattr(
        supervisor,
        "_maybe_idle_after_unchanged_open_ended_done",
        lambda: None,
    )
    monkeypatch.setattr(supervisor, "_resolve_vertical_once", lambda: None)
    monkeypatch.setattr(supervisor, "_wiki_collect_task_if_due_under_blocker", lambda: None)
    monkeypatch.setattr(
        supervisor,
        "_render_journal_for_planner",
        lambda: _note("final_certification_missing"),
    )
    monkeypatch.setattr(supervisor, "_recent_no_progress_failures", lambda: {})
    monkeypatch.setattr(supervisor, "_recent_subagent_family_failures", lambda: {})
    monkeypatch.setattr(supervisor, "_planner_runtime_with_idle_note", lambda: "")

    assert supervisor._plan_next_work() == PLAN_ERROR
    assert planner_runner.calls == 1
    assert supervisor.memory.backlog.all() == []
    error = next(
        event for event in sink.events if event.get("type") == "life.planner.error"
    )
    assert "final_submission scope must be declared in structured task scope" in (
        error["error"]
    )

from __future__ import annotations

import pytest

from argus_skill.core.task_frontier import (
    TaskFrontier,
    load_task_frontier,
    save_task_frontier,
)


def _bounded_regression() -> dict:
    return {
        "change": "bounded_regression",
        "summary": "Shared abstraction changed; two adapters need repair.",
        "new_obligations": ["repair adapter A", "repair adapter B"],
        "regressed_obligations": ["adapter tests temporarily red"],
        "remaining_work": ["repair affected adapter cluster"],
        "proxy_changes": ["focused tests 12→10 passing"],
        "uncertainty": "The affected cluster is now known and finite.",
        "next_decision_point": "Run both adapter suites after repair.",
        "regression": {
            "cause": "Replace the duplicated shared abstraction.",
            "scope": "Only adapters A and B.",
            "budget": "Two focused repair commits and one round.",
            "recovery_test": "Both adapter suites pass.",
            "exit_trigger": "Rollback if a third subsystem regresses.",
        },
    }


def test_bounded_regression_is_progress_without_scalar_monotonicity() -> None:
    frontier = TaskFrontier.initial(
        mission_id="m1",
        objective="remove structural duplication",
        invariants=["public API remains stable"],
        hypothesis="one shared abstraction removes drift",
    )

    transition = frontier.apply(_bounded_regression(), round_index=2)

    assert transition["change"] == "bounded_regression"
    assert frontier.disposition == "continue"
    assert frontier.unchanged_failure_streak == 0
    assert frontier.new_obligations == ["repair adapter A", "repair adapter B"]
    assert frontier.active_regression["recovery_test"] == "Both adapter suites pass."


def test_unbounded_regression_requires_replan() -> None:
    frontier = TaskFrontier.initial(mission_id="m2", objective="strengthen invariant")
    report = _bounded_regression()
    report["regression"]["exit_trigger"] = ""

    transition = frontier.apply(report, round_index=1)

    assert transition["change"] == "unexplained_regression"
    assert frontier.disposition == "replan"


def test_repeated_unchanged_failure_remains_visible_across_restart(tmp_path) -> None:
    path = tmp_path / "frontier.json"
    frontier = TaskFrontier.initial(mission_id="m3", objective="search mechanisms")
    report = {
        "change": "unchanged_failure",
        "summary": "Same mechanism failed with no new information.",
        "next_decision_point": "Abandon or diagnose the unchanged failure.",
    }
    frontier.apply(report, round_index=1)
    save_task_frontier(path, frontier)

    restored = load_task_frontier(path)
    assert restored is not None
    restored.apply(report, round_index=2)
    save_task_frontier(path, restored)

    final = load_task_frontier(path)
    assert final is not None
    assert final.unchanged_failure_streak == 2
    assert final.disposition == "diagnose_or_replan"
    assert [row["round"] for row in final.history] == [1, 2]


@pytest.mark.parametrize(
    ("change", "summary", "regressed", "expected"),
    [
        (
            "bounded_regression",
            "The invariant is stronger while its finite repair cluster is open.",
            ["two proof obligations reopened"],
            "continue",
        ),
        (
            "artifact_improved",
            "The shared module replaced three copies; one local test is temporarily red.",
            ["one adapter test"],
            "continue",
        ),
        (
            "information_gain",
            "The candidate metric fell, falsifying the current optimization mechanism.",
            [],
            "continue",
        ),
    ],
)
def test_representative_long_horizon_transitions_remain_coherent(
    change: str,
    summary: str,
    regressed: list[str],
    expected: str,
) -> None:
    frontier = TaskFrontier.initial(
        mission_id=f"case-{change}",
        objective="reach the goal without requiring monotonic proxies",
        invariants=["correctness remains binding"],
        hypothesis="the current route is testable",
    )
    report = {
        "change": change,
        "summary": summary,
        "regressed_obligations": regressed,
        "remaining_work": ["take the next evidence-based decision"],
        "proxy_changes": ["one local proxy worsened"],
        "uncertainty": "The viable route is now narrower.",
        "next_decision_point": "Recover the bounded debt or replace the hypothesis.",
    }
    if change == "bounded_regression":
        report["regression"] = _bounded_regression()["regression"]

    frontier.apply(report, round_index=1)

    assert frontier.disposition == expected
    assert frontier.history[-1]["summary"] == summary
    assert frontier.remaining_work == ["take the next evidence-based decision"]

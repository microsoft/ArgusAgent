from __future__ import annotations

import json

from argus_skill.reviewer._parsing import parse_decision_text

_BASE = """STATUS=continue
REASON=The shared abstraction improved, with a bounded adapter repair cluster.
NEXT_ACTION=Repair the two adapters and rerun their suites.
OPERATOR_QUESTION=none
CHECKPOINT_RECOMMENDED=true
FORWARD_PROGRESS=true
PLAN_SIGNAL=continue
PLAN_CHALLENGE=none
PLAN_ALTERNATIVE=none
AUTHORITY_IMPACT=technical
FRONTIER_CHANGE=bounded_regression
FRONTIER_SUMMARY=Structural duplication is gone; two adapters are temporarily red.
FRONTIER_OBLIGATIONS=resolved::remove duplicate implementation|new::repair adapter A; repair adapter B|regressed::adapter tests temporarily red|remaining::repair affected cluster
FRONTIER_EVIDENCE=hypothesis::One shared abstraction prevents future drift.|proxies::focused tests 12 to 10 passing|uncertainty::The affected cluster is finite and understood.
NEXT_DECISION_POINT=Rerun both adapter suites.
REGRESSION_ENVELOPE=cause::Replace the duplicated shared abstraction.|scope::Adapters A and B only.|budget::One round and two focused repairs.|recovery::Both adapter suites pass.|exit::Rollback if a third subsystem regresses.
SESSION_SIGNAL=kind::quality_degradation|target::engineer|detail::The resumed Engineer repeated an obsolete repair twice.
"""


def test_named_reviewer_verdict_carries_frontier_and_explicit_session_signal() -> None:
    decision = parse_decision_text(_BASE)

    assert decision is not None
    assert decision.status == "continue"
    assert decision.frontier_report["change"] == "bounded_regression"
    assert decision.frontier_report["new_obligations"] == [
        "repair adapter A",
        "repair adapter B",
    ]
    assert decision.frontier_report["regression"]["exit_trigger"].startswith("Rollback")
    assert decision.session_signal == {
        "kind": "quality_degradation",
        "target": "engineer",
        "detail": "The resumed Engineer repeated an obsolete repair twice.",
    }


def test_missing_regression_envelope_forces_replan() -> None:
    decision = parse_decision_text(_BASE.replace(
        "|exit::Rollback if a third subsystem regresses.",
        "|exit::none",
    ))

    assert decision is not None
    assert decision.status == "replan_requested"
    assert "cannot be accepted as bounded" in decision.reason
    assert decision.planner_report["plan_signal"] == "reconsider"


def test_legacy_json_skill_ops_fixture_is_readable_but_field_is_retired(tmp_path) -> None:
    fixture = {
        "status": "done",
        "reason": "The historical run passed.",
        "next_action": "",
        "operator_question": "",
        "skill_ops": [{"op": "update", "name": "obsolete-runtime-field"}],
    }
    path = tmp_path / "legacy-review.json"
    path.write_text(json.dumps(fixture), encoding="utf-8")

    decision = parse_decision_text(path.read_text(encoding="utf-8"))

    assert decision is not None
    assert decision.status == "done"
    assert not hasattr(decision, "skill_ops")

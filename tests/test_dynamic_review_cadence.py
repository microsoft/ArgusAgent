"""Reviewer cadence follows the explicit independent-review contract."""
from __future__ import annotations

import json
from pathlib import Path

from argus_skill.adapters.memory_backend import CannedResponse, MemoryBackend
from argus_skill.engineer.runner import (
    EngineerConfig,
    SupervisedConfig,
    SupervisedEngineer,
    parse_continue_work_request,
)
from argus_skill.reviewer import Reviewer, ReviewerConfig


def _done_review() -> str:
    return json.dumps({
        "status": "done",
        "reason": "reviewed",
        "next_action": "",
        "round_summary_markdown": "# done\n",
        "completion_summary_markdown": "Done.",
    })


def _engineer(backend: MemoryBackend) -> SupervisedEngineer:
    return SupervisedEngineer(
        engineer_runner=backend,
        reviewer=Reviewer(runner=backend),
        engineer_config=EngineerConfig(model="m"),
        reviewer_config=ReviewerConfig(model="m"),
    )


def test_legacy_continue_work_parser_remains_compatible() -> None:
    assert parse_continue_work_request(
        "Changed the parser.\nCONTINUE_WORK: wire it into the runner"
    ) == "wire it into the runner"
    assert parse_continue_work_request("CONTINUE_WORK: wire it in") is None


def test_continue_work_text_does_not_skip_reviewer(tmp_path: Path) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "## Verification (verbatim)\n```\n1 passed\n```\n"
                "CONTINUE_WORK: wire it into the runner"
            ),
            thread_id="t1",
        ),
    )
    backend.queue("reviewer", CannedResponse(message=_done_review(), thread_id="v1"))

    events: list[dict] = []
    status, rounds, _final, _reason, tid = _engineer(backend).run(
        objective="always review",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(
            max_rounds=2,
        ),
        workdir=tmp_path,
        on_event=events.append,
    )

    labels = [label for label, _prompt, _options in backend.history]
    assert labels[:2] == ["engineer-r1", "reviewer"]
    assert not any(event["type"] == "round.review.deferred" for event in events)
    assert status == "done"
    assert len(rounds) == 1
    assert tid is None
    assert [
        resume for label, resume in backend.resume_history
        if label in {"engineer-r1", "reviewer"}
    ] == [None, None]


def test_low_risk_task_can_finish_with_engineer_self_review(tmp_path: Path) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "Implemented the bounded fix.\n## Verification\n3 tests passed\n"
                "`MILESTONE_STATUS=done`"
            ),
            thread_id="t1",
        ),
    )

    events: list[dict] = []
    status, rounds, _final, reason, tid = _engineer(backend).run(
        objective="low-risk repair with decisive tests",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(
            max_rounds=1,
            require_independent_review=False,
        ),
        workdir=tmp_path,
        on_event=events.append,
    )

    assert [label for label, _prompt, _options in backend.history] == ["engineer-r1"]
    assert status == "done"
    assert len(rounds) == 1
    assert rounds[0].review.review_source == "engineer_self_review"
    review_events = [event for event in events if event["type"] == "round.review.completed"]
    assert review_events[0]["review_source"] == "engineer_self_review"
    assert "independent review was not required" in reason
    assert "Host-defined" not in reason
    assert tid is None


def test_engineer_continues_milestone_without_reviewer(tmp_path: Path) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message="Captured the signal.\nMILESTONE_STATUS=continue",
            thread_id="t1",
        ),
    )
    backend.queue(
        "engineer-r2",
        CannedResponse(
            message="Made the keep/reject decision.\nMILESTONE_STATUS=done",
            thread_id="t2",
        ),
    )

    status, rounds, _final, _reason, _tid = _engineer(backend).run(
        objective="complete one decision-sized milestone",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(
            max_rounds=2,
            require_independent_review=False,
        ),
        workdir=tmp_path,
    )

    assert status == "done"
    assert [label for label, _prompt, _options in backend.history] == [
        "engineer-r1",
        "engineer-r2",
    ]
    assert len(rounds) == 1


def test_engineer_operator_question_parks_without_reviewer(tmp_path: Path) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "The required choice belongs to the operator.\n"
                "MILESTONE_STATUS=continue\n"
                "`OPERATOR_QUESTION=请选择 A 或 B`\n"
                "`OPERATOR_OPTIONS=route-a :: 选择 A :: 使用 A 路线继续。; "
                "route-b :: 选择 B :: 使用 B 路线继续。`"
            ),
            thread_id="t1",
        ),
    )

    events: list[dict] = []
    status, rounds, _final, reason, _tid = _engineer(backend).run(
        objective="write the operator-selected value",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(
            max_rounds=3,
            require_independent_review=True,
        ),
        workdir=tmp_path,
        on_event=events.append,
    )

    assert [label for label, _prompt, _options in backend.history] == ["engineer-r1"]
    assert status == "blocked"
    assert len(rounds) == 1
    assert rounds[0].review.review_source == "engineer_operator_question"
    assert rounds[0].review.operator_question == "请选择 A 或 B"
    assert [option["label"] for option in rounds[0].review.operator_options] == [
        "选择 A",
        "选择 B",
    ]
    assert rounds[0].review.planner_report["authority_impact"] == "operator"
    assert "operator-owned decision" in reason
    review_events = [event for event in events if event["type"] == "round.review.completed"]
    assert review_events[0]["operator_question"] == "请选择 A 或 B"
    assert review_events[0]["operator_options"][0]["id"] == "route-a"


def test_engineer_reviewer_request_enters_independent_review(tmp_path: Path) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "Completed the artifact and its check script.\n"
                "MILESTONE_STATUS=continue\n"
                "OPERATOR_QUESTION=Please invoke the independent hostile Reviewer "
                "to review this artifact.\n"
                "OPERATOR_OPTIONS=review :: Invoke hostile Reviewer :: "
                "Run the standard independent review."
            ),
            thread_id="t1",
        ),
    )
    backend.queue("reviewer", CannedResponse(message=_done_review(), thread_id="v1"))

    status, rounds, _final, _reason, _tid = _engineer(backend).run(
        objective="complete and independently review the artifact",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(max_rounds=2, require_independent_review=True),
        workdir=tmp_path,
    )

    assert [label for label, _prompt, _options in backend.history] == [
        "engineer-r1",
        "reviewer",
    ]
    assert status == "done"
    assert rounds[0].review.review_source == "reviewer"
    assert rounds[0].review.operator_question == ""


def test_structured_reviewer_handoff_does_not_override_real_authority(
    tmp_path: Path,
) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "MILESTONE_STATUS=continue\n"
                "NEXT_OWNER=reviewer\n"
                "OPERATOR_QUESTION=Authorize the budget and external publication "
                "before review.\n"
                "OPERATOR_OPTIONS=approve :: Approve :: Spend budget and publish."
            ),
            thread_id="t1",
        ),
    )

    status, rounds, _final, _reason, _tid = _engineer(backend).run(
        objective="publish an artifact",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(max_rounds=2, require_independent_review=True),
        workdir=tmp_path,
    )

    assert [label for label, _prompt, _options in backend.history] == ["engineer-r1"]
    assert status == "blocked"
    assert rounds[0].review.operator_question.startswith("Authorize the budget")


def test_explicit_operator_handoff_is_authoritative_for_reviewer_wording(
    tmp_path: Path,
) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "MILESTONE_STATUS=continue\n"
                "NEXT_OWNER=operator\n"
                "OPERATOR_QUESTION=Please authorize invoking the independent Reviewer.\n"
                "OPERATOR_OPTIONS=approve :: Approve :: Grant authorization."
            ),
            thread_id="t1",
        ),
    )

    status, rounds, _final, _reason, _tid = _engineer(backend).run(
        objective="perform an authorization-gated review",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(max_rounds=2, require_independent_review=True),
        workdir=tmp_path,
    )

    assert [label for label, _prompt, _options in backend.history] == ["engineer-r1"]
    assert status == "blocked"
    assert rounds[0].review.operator_question.startswith("Please authorize")


def test_legacy_reviewer_wording_does_not_bypass_operator_approval(
    tmp_path: Path,
) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "MILESTONE_STATUS=continue\n"
                "OPERATOR_QUESTION=Request the independent Reviewer after operator approval.\n"
                "OPERATOR_OPTIONS=approve :: Approve review :: Grant approval."
            ),
            thread_id="t1",
        ),
    )

    status, rounds, _final, _reason, _tid = _engineer(backend).run(
        objective="perform an approval-gated review",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(max_rounds=2, require_independent_review=True),
        workdir=tmp_path,
    )

    assert [label for label, _prompt, _options in backend.history] == ["engineer-r1"]
    assert status == "blocked"
    assert rounds[0].review.operator_question.startswith("Request the independent")


def test_structured_engineer_handoff_continues_without_early_review(
    tmp_path: Path,
) -> None:
    backend = MemoryBackend()
    backend.queue(
        "engineer-r1",
        CannedResponse(
            message=(
                "Completed the first internal step.\n"
                "MILESTONE_STATUS=continue\n"
                "NEXT_OWNER=engineer\n"
                "OPERATOR_QUESTION=none"
            ),
            thread_id="t1",
        ),
    )
    backend.queue(
        "engineer-r2",
        CannedResponse(
            message=(
                "Completed the artifact.\n"
                "MILESTONE_STATUS=done\n"
                "NEXT_OWNER=reviewer\n"
                "OPERATOR_QUESTION=none"
            ),
            thread_id="t2",
        ),
    )
    backend.queue("reviewer", CannedResponse(message=_done_review(), thread_id="v1"))

    status, rounds, _final, _reason, _tid = _engineer(backend).run(
        objective="complete a two-step artifact",
        engineer_prompt_builder=lambda _na, _include_static=True: "Do the task.",
        supervised_config=SupervisedConfig(max_rounds=2, require_independent_review=True),
        workdir=tmp_path,
    )

    assert [label for label, _prompt, _options in backend.history] == [
        "engineer-r1",
        "engineer-r2",
        "reviewer",
    ]
    assert status == "done"
    assert len(rounds) == 1

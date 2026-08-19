from __future__ import annotations

from argus_skill.apps._runtime_helpers import _should_run_stage_transition


def test_non_stage_closing_planner_node_cannot_move_pipeline_stage() -> None:
    assert not _should_run_stage_transition(
        "done",
        mission_scope="bounded",
        require_independent_review=True,
        review_source="reviewer",
        preplanned=True,
        stage_closing=False,
    )


def test_stage_closing_planner_node_reaches_manager_stage_writer() -> None:
    assert _should_run_stage_transition(
        "done",
        mission_scope="bounded",
        require_independent_review=True,
        review_source="reviewer",
        preplanned=True,
        stage_closing=True,
    )


def test_direct_reviewed_work_preserves_legacy_stage_transition() -> None:
    assert _should_run_stage_transition(
        "done",
        mission_scope="bounded",
        review_source="reviewer",
        preplanned=False,
        stage_closing=False,
    )


def test_final_submission_is_stage_eligible_without_bounded_flag() -> None:
    assert _should_run_stage_transition(
        "done",
        mission_scope="final_submission",
        review_source="reviewer",
        preplanned=True,
        stage_closing=False,
    )


def test_worker_without_stage_authority_never_reaches_the_stage_writer() -> None:
    """A dispatched teammate runs in the project root and must not write its stage.

    The shape a teammate actually presents: no bounded scope (it is handed one
    task, not a Planner node), a vertical that does not require independent
    review, and a Reviewer verdict — which is exactly the combination the
    legacy tail of the guard lets through. N of them run concurrently against
    one ``.argus/PIPELINE_STATE.json``.
    """
    kwargs = dict(
        mission_scope="",
        require_independent_review=False,
        review_source="reviewer",
        preplanned=False,
        stage_closing=False,
    )
    assert _should_run_stage_transition("done", **kwargs)
    assert not _should_run_stage_transition(
        "done", holds_stage_authority=False, **kwargs
    )


def test_withheld_stage_authority_outranks_every_other_eligibility_route() -> None:
    """Not a "which kind of work is this" question, so nothing overrides it.

    ``final_submission`` and an independent-review entitlement are the two
    strongest reasons a mission may move the stage; neither makes a subordinate
    worker the project's stage authority.
    """
    assert not _should_run_stage_transition(
        "done",
        mission_scope="final_submission",
        require_independent_review=True,
        review_source="reviewer",
        stage_closing=True,
        holds_stage_authority=False,
    )


def test_teammate_entry_withholds_stage_authority_from_its_mission() -> None:
    """The flag is only worth having if the teammate actually passes it.

    Asserted against the real ``execute`` signature rather than a stub, because
    the previous attempt at this fix passed a keyword the runner accepted and
    then ignored — the failure mode is silent, so a hand-written double would
    have reproduced the bug rather than caught it.
    """
    import inspect

    from argus_skill.apps._runtime_execute import SkillLoopExecuteMixin
    from argus_skill.team import teammate_entry

    assert "holds_stage_authority" in inspect.signature(
        SkillLoopExecuteMixin.execute
    ).parameters
    source = inspect.getsource(teammate_entry.run_one_engineer_mission)
    assert "holds_stage_authority=False" in source

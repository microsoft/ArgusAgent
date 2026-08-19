"""Reviewer prompt size budget — regression guard against prose re-bloat.

The reviewer prompt built by ``_build_prompt`` is assembled and sent every
review round. Its fixed instruction prose had grown to restate the same ideas
3-6x with worked examples; an operator-requested compression cut the decision /
planner-report / checkpoint / step-back prose roughly in half while preserving
every consumed named verdict field and every anti-cheat guardrail.

This test pins a CHARACTER BUDGET on the built non-measured prompt so fixed
policy prose cannot silently regrow. Task-specific checklists remain allowed;
role/routing and named-verdict explanations must stay compact.
"""

from __future__ import annotations

from argus_skill.reviewer import Reviewer

# Repeated evidence-policy prose was removed; the representative prompt is now
# about 9.4k chars. Keep headroom for task checklists without permitting the
# global policy block to return.
#
# 9_000 -> 9_500 for two deliberate new blocks, one from each side of the merge,
# neither of them the prose regrowth this guard exists to catch:
#   * the RESULT_FIELD_CHOICES enumeration (602 chars) — the legal verbatim
#     values for each research-result field, replacing prose that named the
#     fields but not what they accept, which is the mismatch that voided results;
#   * the root-cause evidence bar (~370 chars) — a threshold miss is not a
#     diagnosis, so a dominant-stage or replacement-architecture claim needs
#     profiling or a counterfactual behind it.
# 9_500 -> 10_050 for the two independent Research ideation gates. The
# deterministic validator carries the detailed contract; the repeated Reviewer
# prompt adds only the concise portfolio/adversarial checklist entries.
NON_MEASURED_BUDGET = 8_000


def _build(measured: bool, monkeypatch) -> str:
    if measured:
        monkeypatch.setenv("ARGUS_SKILL_MEASURED_MODE", "1")
    else:
        monkeypatch.delenv("ARGUS_SKILL_MEASURED_MODE", raising=False)
    r = Reviewer(runner=None, skill_store=None)
    return r._build_prompt(
        objective="minimize cand_ms on the kernel",
        operator_messages=["make the kernel faster"],
        planner_review_instruction="",
        round_index=1,
        session_id=None,
        main_summary="HANDOFF: tried X. RESULT correct=true cand_ms=0.5",
        main_error=None,
        prior_checkpoint={},
    )


def test_non_measured_prompt_within_budget(monkeypatch):
    p = _build(measured=False, monkeypatch=monkeypatch)
    assert len(p) < NON_MEASURED_BUDGET, (
        f"reviewer non-measured prompt is {len(p)} chars, over the "
        f"{NON_MEASURED_BUDGET} budget. The fixed instruction prose has "
        "regrown — re-compress (delete repetition/examples) rather than raising "
        "this cap, unless a genuinely new block was deliberately added."
    )


def test_compression_removed_redundant_examples(monkeypatch):
    # Tie the guard to the actual compression, not just a byte count: these
    # verbose snippets were deleted and must not reappear (they are the
    # redundancy the cut targeted).
    p = _build(measured=False, monkeypatch=monkeypatch)
    assert "you are not a JSON robot" not in p
    assert "Anti-pattern: agent shows test_accuracy=0.98" not in p
    assert "expense_tracker/ package using unittest" not in p
    assert "## Evidence policy" not in p


def test_the_verdict_vocabulary_is_stated_once(monkeypatch):
    # `done`/`continue`/`replan_requested`/`blocked` used to be defined twice —
    # once in the role block and again, at greater length, in the handoff
    # policy. Two definitions of the same four words is the redundancy this
    # budget exists to catch, and it cost more than the sentence it funded.
    p = _build(measured=False, monkeypatch=monkeypatch)
    assert p.count("agent-fixable in-scope gap") == 1
    assert p.count("replacement route, or boundary change") == 1


def test_reviewer_records_prompt_block_token_estimates(monkeypatch):
    monkeypatch.delenv("ARGUS_SKILL_MEASURED_MODE", raising=False)
    reviewer = Reviewer(runner=None, skill_store=None)
    prompt = reviewer._build_prompt(
        objective="audit the current research result",
        operator_messages=[],
        planner_review_instruction="",
        round_index=1,
        session_id=None,
        main_summary="RESULT: evidence exists",
        main_error=None,
        prior_checkpoint={},
    )

    stats = reviewer.last_prompt_block_stats
    assert stats["static_total"]["chars"] > 0
    assert stats["delta_total"]["chars"] > 0
    assert stats["main_summary"]["chars"] == len("RESULT: evidence exists")
    assert stats["static_total"]["estimated_tokens"] > 0
    assert stats["static_total"]["chars"] + stats["delta_total"]["chars"] == len(prompt)


def test_reviewer_does_not_duplicate_identical_objective(monkeypatch):
    monkeypatch.delenv("ARGUS_SKILL_MEASURED_MODE", raising=False)
    reviewer = Reviewer(runner=None, skill_store=None)
    objective = "repair the exact benchmark evidence " * 120

    prompt = reviewer._build_prompt(
        objective=objective,
        original_objective=objective,
        operator_messages=[],
        planner_review_instruction="",
        round_index=1,
        session_id=None,
        main_summary="done",
        main_error=None,
        prior_checkpoint={},
    )

    assert prompt.count(objective.strip()) == 1
    assert "Task objective:" in prompt
    assert "Original operator request:" not in prompt
    assert reviewer.last_prompt_block_stats["objective_context"]["chars"] < (len(objective) + 64)


def test_reviewer_keeps_distinct_original_and_mission_objectives(monkeypatch):
    reviewer = Reviewer(runner=None, skill_store=None)
    prompt = reviewer._build_prompt(
        objective="repair the benchmark",
        original_objective="produce a publishable paper",
        operator_messages=[],
        planner_review_instruction="",
        round_index=1,
        session_id=None,
        main_summary="done",
        main_error=None,
        prior_checkpoint={},
    )

    assert "Original operator request:\nproduce a publishable paper" in prompt
    assert "Current mission objective:\nrepair the benchmark" in prompt


def test_research_target_context_stays_compact(tmp_path, monkeypatch):
    """The block may hold the contract's vocabulary, and nothing more.

    The bound was 1_100 chars while the block listed the five research-result
    field *names* and none of their legal values. Testbed run 15
    (``s-f0dbba19``) emitted six ``RESEARCH_RESULT`` blocks under it and the
    contract rejected all six, every one for inventing vocabulary the prompt
    had never supplied. Enumerating the five value sets costs ~600 chars, and
    600 chars that make a hard gate answerable are worth more than a bound
    that made it unanswerable.

    So the guard moves rather than disappears, and what it now guards is
    prose: the value lists are rendered from ``RESULT_FIELD_CHOICES``, so they
    track the contract on their own and only added text can push this over.
    The margin above is sized for the longest verification-profile line, not
    for another paragraph.
    """
    from argus_skill.skills.vertical_select import persist_vertical

    persist_vertical(
        tmp_path,
        "research",
        research_target_level="publishable",
    )
    reviewer = Reviewer(runner=None, skill_store=None)
    reviewer._build_prompt(
        objective="repair the benchmark",
        original_objective="repair the benchmark",
        operator_messages=[],
        planner_review_instruction="",
        round_index=1,
        session_id=None,
        main_summary="done",
        main_error=None,
        prior_checkpoint={},
        working_dir=str(tmp_path),
        scope="bounded",
    )

    stats = reviewer.last_prompt_block_stats["research_target"]
    assert stats["chars"] < 1_320
    assert stats["estimated_tokens"] < 340


def test_reviewer_prompt_records_process_decision_without_final_footer(monkeypatch) -> None:
    prompt = _build(measured=False, monkeypatch=monkeypatch)

    assert "ARGUS_ROLE_DECISION=" in prompt
    assert '"role":"reviewer"' in prompt
    assert "Any later response is plain language and is not parsed." in prompt
    assert "STATUS=done|continue|blocked|replan_requested" not in prompt
    assert "JSON Schema" not in prompt
    assert "OUTPUT CONTRACT (STRICT)" not in prompt


def test_reviewer_replans_materially_ungrounded_external_implementation(
    monkeypatch,
) -> None:
    prompt = _build(measured=False, monkeypatch=monkeypatch)

    assert "primary-source grounding" in prompt
    assert "Community implementations alone are insufficient" in prompt
    assert "Return `replan_requested`" in prompt
    assert "do not demand new research for local-only work" in prompt

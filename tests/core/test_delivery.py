from __future__ import annotations

import json
from pathlib import Path

from argus_skill.life.delivery import build_delivery_receipt


def test_delivery_receipt_prefers_reviewer_evidence_and_rejects_unsafe_paths(
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "workspace"
    state = tmp_path / "state"
    workspace.mkdir()
    state.mkdir()
    (workspace / "final.md").write_text("# Final\n", encoding="utf-8")
    (workspace / "fallback.md").write_text("# Fallback\n", encoding="utf-8")
    live_root = state / ".argus"
    live_root.mkdir()
    (live_root / "live-view.json").write_text(
        json.dumps({
            "title": "Current result",
            "reason": "Useful fallback.",
            "paths": ["fallback.md"],
        }),
        encoding="utf-8",
    )

    receipt = build_delivery_receipt(
        item_id="task-1",
        title="Create final result",
        summary="Verified final result.",
        success=True,
        overall_complete=True,
        status="done",
        review_status="done",
        final_submission_certified=False,
        workspace=workspace,
        state_root=state,
        reviewer_artifacts=["final.md", "../secret.txt", ".env"],
    )

    assert receipt is not None
    assert receipt["delivery_id"] == "delivery:task-1:task_completed"
    assert receipt["primary_target"]["path"] == "final.md"
    assert [target["path"] for target in receipt["targets"]] == ["final.md"]


def test_intermediate_success_has_no_delivery_even_with_an_artifact(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    state = tmp_path / "state"
    workspace.mkdir()
    state.mkdir()
    (workspace / "partial.md").write_text("partial\n", encoding="utf-8")

    assert build_delivery_receipt(
        item_id="task-partial",
        title="Resume task",
        summary="One stage advanced.",
        success=True,
        overall_complete=False,
        status="done",
        review_status="done",
        final_submission_certified=False,
        workspace=workspace,
        state_root=state,
        reviewer_artifacts=["partial.md"],
    ) is None


def test_delivery_receipt_does_not_exist_without_a_renderable_file(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    state = tmp_path / "state"
    workspace.mkdir()
    state.mkdir()

    receipt = build_delivery_receipt(
        item_id="task-2",
        title="Finish analysis",
        summary="The bounded analysis is complete.",
        success=True,
        overall_complete=True,
        status="done",
        review_status="done",
        final_submission_certified=False,
        workspace=workspace,
        state_root=state,
    )

    assert receipt is None


def test_failed_mission_has_no_delivery_receipt(tmp_path: Path) -> None:
    assert build_delivery_receipt(
        item_id="task-3",
        title="Blocked task",
        summary="",
        success=False,
        overall_complete=False,
        status="blocked",
        review_status="blocked",
        final_submission_certified=False,
        workspace=tmp_path,
        state_root=tmp_path,
    ) is None

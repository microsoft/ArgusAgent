from __future__ import annotations

from pathlib import Path

from argus_skill.life.memory import Backlog, BacklogItem


def test_replacement_supersedes_all_pending_work_including_legacy_bootstrap(
    tmp_path: Path,
) -> None:
    backlog = Backlog(tmp_path / "backlog.jsonl")
    old_a = backlog.add(BacklogItem.new(title="old a", objective="a"))
    old_b = backlog.add(BacklogItem.new(title="old b", objective="b"))
    legacy_bootstrap = backlog.add(
        BacklogItem.new(
            title="legacy project setup",
            objective="seed",
            tags=["bootstrap", "project"],
        )
    )
    paused = backlog.add(BacklogItem.new(title="paused old work", objective="paused"))
    backlog.update(paused.id, status="paused_daemon_shutdown")
    running = backlog.add(BacklogItem.new(title="running work", objective="running"))
    backlog.update(running.id, status="running")

    superseded = backlog.supersede_pending_for_replacement(
        reason="operator replaced objective",
        replacement_id="intent-new",
    )

    assert set(superseded) == {
        old_a.id,
        old_b.id,
        legacy_bootstrap.id,
        paused.id,
    }
    rows = {item.id: item for item in backlog.all()}
    assert rows[old_a.id].status == "superseded"
    assert rows[old_b.id].superseded_by_plan_id == "intent-new"
    assert rows[legacy_bootstrap.id].status == "superseded"
    assert rows[paused.id].status == "superseded"
    assert rows[running.id].status == "running"

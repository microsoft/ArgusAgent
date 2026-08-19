"""paper_mission must follow the VERTICAL, not a True default.

Regression: paper behavior must be an explicit vertical capability, not inferred
from ``completion_gate="certified"``. Quant and medical also use certified
completion, but must not inherit the research paper pipeline.
"""
from __future__ import annotations

import pytest

from argus_skill.apps._runtime import (
    _final_certification_for_project_root,
    _paper_mission_for_project_root,
)
from argus_skill.skills.vertical_select import persist_vertical
from argus_skill.verticals._base import (
    load_vertical,
    vertical_is_paper_mission,
)

OPTIMIZE = ["kernelbench", "speedrun", "nanochat", "nanogpt_speedrun", "math_synth"]


@pytest.mark.parametrize("vertical", OPTIMIZE)
def test_optimize_verticals_are_not_paper(vertical: str) -> None:
    assert vertical_is_paper_mission(load_vertical(vertical)) is False


def test_research_is_paper() -> None:
    assert vertical_is_paper_mission(load_vertical("research")) is True


@pytest.mark.parametrize("vertical", ["medical", "quant"])
def test_certified_nonpaper_verticals_are_not_paper(vertical: str) -> None:
    assert vertical_is_paper_mission(load_vertical(vertical)) is False


@pytest.mark.parametrize("vertical", ["research", "medical", "quant"])
def test_certified_verticals_keep_final_certification(
    tmp_path, vertical: str
) -> None:
    persist_vertical(tmp_path, vertical)
    assert _final_certification_for_project_root(tmp_path) is True


def test_undecided_project_is_not_implicitly_paper(tmp_path) -> None:
    assert _paper_mission_for_project_root(tmp_path) is False


def test_persisted_research_project_is_paper(tmp_path) -> None:
    persist_vertical(tmp_path, "research")
    assert _paper_mission_for_project_root(tmp_path) is True


def test_direct_research_project_is_not_a_paper_mission(tmp_path) -> None:
    persist_vertical(tmp_path, "research", workflow_mode="direct")
    assert _paper_mission_for_project_root(tmp_path) is False


def test_persisted_bounded_vertical_is_not_paper(tmp_path) -> None:
    persist_vertical(tmp_path, "kernelbench")
    assert _paper_mission_for_project_root(tmp_path) is False

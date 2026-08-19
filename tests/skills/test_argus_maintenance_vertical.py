from __future__ import annotations

import json
from pathlib import Path

from argus_skill import SkillLoop, SkillLoopConfig
from argus_skill.adapters.memory_backend import CannedResponse, MemoryBackend
from argus_skill.manager._core import Manager
from argus_skill.skills.builtins import seed_builtin_skills_for_vertical
from argus_skill.skills.vertical_select import (
    VERTICAL_PURPOSES,
    VERTICALS,
    persist_vertical,
)
from argus_skill.verticals._base import load_vertical_contract
from argus_skill.verticals.argus_maintenance.architecture_audit import scan_repository


def test_argus_maintenance_contract_is_built_in(tmp_path: Path) -> None:
    assert "argus_maintenance" in VERTICALS
    assert "Argus" in VERTICAL_PURPOSES["argus_maintenance"]
    persist_vertical(tmp_path, "argus_maintenance")

    contract = load_vertical_contract("argus_maintenance")
    assert contract.stage_order == ("inspect", "change", "verify")
    assert contract.mission_kind == "software"
    assert contract.ground_before_handoff is True
    assert contract.requires_independent_review is True
    assert Manager._kind_for("argus_maintenance") == "software"
    assert Manager._kind_for("software") == "software"
    assert Manager._kind_for("research") == "research"
    assert Manager._kind_for("speedrun") == "optimize"
    assert Manager._kind_for("chip_design") == "custom"


def test_explicit_vertical_reaches_engineer_and_reviewer_without_pipeline_state(
    tmp_path: Path,
) -> None:
    skills = tmp_path / "skills"
    skills.mkdir()
    backend = MemoryBackend()
    backend.queue("engineer-r1", CannedResponse(message="Implemented and verified."))
    backend.queue(
        "reviewer",
        CannedResponse(message=json.dumps({
            "status": "done",
            "reason": "Verified.",
            "next_action": "None.",
            "round_summary_markdown": "# Review\\n\\n- verified\\n",
            "completion_summary_markdown": "Verified.",
        })),
    )
    loop = SkillLoop(
        skills_dir=skills,
        engineer_runner=backend,
        reviewer_runner=backend,
        config=SkillLoopConfig(
            max_rounds=1,
            workflow_mode="direct",
            active_vertical="argus_maintenance",
        ),
    )

    outcome = loop.run("Maintain Argus.", workdir=tmp_path, scope="bounded")

    assert outcome.successful
    engineer_prompt = next(
        prompt for label, prompt, _options in backend.history
        if label == "engineer-r1"
    )
    reviewer_prompt = next(
        prompt for label, prompt, _options in backend.history
        if label == "reviewer"
    )
    assert "ARGUS MAINTENANCE" in engineer_prompt
    assert "ARGUS MAINTENANCE" in reviewer_prompt


def test_argus_maintenance_skills_are_packaged(tmp_path: Path) -> None:
    written = seed_builtin_skills_for_vertical(
        tmp_path,
        "argus_maintenance",
        overwrite=True,
    )

    expected = {
        "engineer/argus-maintenance-execution.md",
        "reviewer/argus-maintenance-review.md",
    }
    assert expected <= written.keys()
    assert all((tmp_path / relative).is_file() for relative in expected)


def test_architecture_audit_surfaces_candidates_without_calling_them_defects(
    tmp_path: Path,
) -> None:
    source = tmp_path / "argus_skill" / "core" / "sample.py"
    source.parent.mkdir(parents=True)
    source.write_text(
        "from argus_skill.verticals.research.tool import run\n"
        "GPU = 'B200'\n"
        "HOME = '/home/alice/work'\n"
        "DIGEST = '0123456789abcdef0123456789abcdef'\n"
        "def wrapper(value):\n"
        "    return run(value)\n"
        "def choose(a, b, c):\n"
        "    assert a is not None\n"
        "    try:\n"
        "        return a or b or c\n"
        "    except Exception:\n"
        "        pass\n",
        encoding="utf-8",
    )
    test_source = tmp_path / "tests" / "test_sample.py"
    test_source.parent.mkdir()
    test_source.write_text("def test_ok():\n    assert True\n", encoding="utf-8")

    report = scan_repository(tmp_path)
    categories = report["counts"]["by_category"]

    assert categories["concrete_vertical_import"] == 1
    assert categories["domain_literal_outside_vertical"] == 1
    assert categories["fallback_chain"] == 1
    assert categories["hardcoded_digest"] == 1
    assert categories["machine_specific_path"] == 1
    assert categories["runtime_assert"] == 1
    assert categories["silent_broad_exception"] == 1
    assert categories["thin_wrapper"] == 1
    assert all(row["path"] != "tests/test_sample.py" for row in report["findings"])

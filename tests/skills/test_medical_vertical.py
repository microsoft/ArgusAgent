from __future__ import annotations

import json
from pathlib import Path

import yaml

from argus_skill.domains import BUILTIN_DOMAINS, DOMAIN_PURPOSES
from argus_skill.manager import Manager
from argus_skill.skills.builtins import iter_vertical_skill_texts
from argus_skill.skills.stage_machine import (
    ChecklistLoadState,
    resolve_stage_checklist_contract,
)
from argus_skill.skills.vertical_select import (
    VERTICAL_PURPOSES,
    VERTICALS,
    persist_vertical,
    require_vertical,
    resolve_vertical,
)
from argus_skill.verticals._base import (
    load_vertical,
    vertical_checklist_items,
    vertical_checklist_stage_order,
    vertical_completion_contract_version,
    vertical_completion_gate,
    vertical_requires_independent_review,
    vertical_role_banner,
    vertical_stage_completion_issues,
    vertical_stage_primary_deliverables,
    vertical_workflow_mode,
)

STAGES = ("scope", "retrieve", "normalize", "analyze", "review", "deliver")
SKILLS = {
    "manager/medical-manager.md",
    "planner/medical-planning.md",
    "engineer/target-disease-research.md",
    "reviewer/medical-evidence-review.md",
}


def test_medical_is_registered_as_a_vertical_not_a_domain() -> None:
    assert "medical" in VERTICALS
    assert "medical" in VERTICAL_PURPOSES
    assert "medical" not in BUILTIN_DOMAINS
    assert "medical" not in DOMAIN_PURPOSES
    assert require_vertical("medical") == "medical"

    mod = load_vertical("medical")
    assert mod.__name__ == "argus_skill.verticals.medical.stages"
    assert vertical_checklist_stage_order(mod) == STAGES


def test_medical_owns_certified_independently_reviewed_workflow() -> None:
    mod = load_vertical("medical")

    assert vertical_workflow_mode(mod) == "staged"
    assert vertical_completion_gate(mod) == "certified"
    assert vertical_requires_independent_review(mod) is True
    assert vertical_completion_contract_version(mod) == 1
    assert Manager._kind_for("medical") == "research"


def test_medical_persists_and_starts_at_scope(tmp_path: Path) -> None:
    persist_vertical(tmp_path, "medical")

    state = json.loads(
        (tmp_path / ".argus" / "PIPELINE_STATE.json").read_text(encoding="utf-8")
    )
    assert state["vertical"] == "medical"
    assert state["current_stage"] == "scope"
    assert "domain" not in state
    assert resolve_vertical(tmp_path) == "medical"


def test_medical_checklists_cover_each_owned_stage(tmp_path: Path) -> None:
    persist_vertical(tmp_path, "medical")
    items = vertical_checklist_items(load_vertical("medical"))

    assert tuple(items) == STAGES
    assert all(items[stage] for stage in STAGES)
    ids = {item.id for stage_items in items.values() for item in stage_items}
    assert {
        "scope.medical-scope",
        "scope.medical-identity",
        "retrieve.medical-source-plan",
        "retrieve.medical-provenance",
        "retrieve.medical-failures",
        "normalize.medical-comparability",
        "analyze.medical-evidence-strata",
        "analyze.medical-claim-ceiling",
        "analyze.medical-conflicts",
        "review.medical-source-support",
        "review.medical-numeric-fidelity",
        "deliver.medical-nondiagnostic-boundary",
        "deliver.medical-auditability",
    } == ids
    for stage in STAGES:
        contract = resolve_stage_checklist_contract(stage, project_root=tmp_path)
        assert contract.state is ChecklistLoadState.LOADED
        assert contract.items


def test_medical_role_banners_and_skills_are_packaged() -> None:
    mod = load_vertical("medical")
    manager = vertical_role_banner(mod, "manager")
    planner = vertical_role_banner(mod, "planner")
    engineer = vertical_role_banner(mod, "engineer")
    reviewer = vertical_role_banner(mod, "reviewer")

    assert "patient-specific" in manager
    assert "medical vertical" in manager.casefold()
    assert "medical domain" not in manager.casefold()
    assert "human genetics" in planner
    assert "PubMed" in engineer
    assert "registration is not efficacy" in reviewer.casefold()

    skills = dict(iter_vertical_skill_texts("medical"))
    assert set(skills) == SKILLS
    for name, text in skills.items():
        front, separator, body = text[4:].partition("\n---\n")
        assert text.startswith("---\n") and separator and body.strip(), name
        assert set(yaml.safe_load(front)) == {"name", "description"}, name

    target_disease = skills["engineer/target-disease-research.md"]
    assert "python -m argus_skill.verticals.medical.dossier" in target_disease
    assert "argus_skill.domains.medical" not in target_disease


def test_deliver_stage_requires_valid_dossier(tmp_path: Path) -> None:
    mod = load_vertical("medical")
    issues = vertical_stage_completion_issues(
        mod,
        stage="deliver",
        project_root=tmp_path,
    )
    assert "missing scope.json" in issues
    assert vertical_stage_primary_deliverables(mod, stage="deliver") == (
        "medical/evidence.jsonl",
        "medical/evidence_matrix.csv",
        "medical/target_disease_memo.md",
        "medical/review.json",
    )

    from argus_skill.verticals.medical.dossier import build_target_disease_dossier

    fixtures = Path(__file__).parents[1] / "domains" / "fixtures"
    pubmed = json.loads((fixtures / "pubmed_esummary.json").read_text())
    trials = json.loads((fixtures / "clinical_trials_v2.json").read_text())
    build_target_disease_dossier(
        tmp_path,
        target="EGFR",
        disease="non-small cell lung cancer",
        pubmed_payload=pubmed,
        clinical_trials_payload=trials,
        retrieved_at="2026-08-10T12:00:00Z",
    )

    assert vertical_stage_completion_issues(
        mod,
        stage="deliver",
        project_root=tmp_path,
    ) == ()

from __future__ import annotations

import json
from pathlib import Path

import pytest

from argus_skill.verticals.medical.evidence import (
    EvidenceRecord,
    MedicalScope,
    normalize_clinical_trials,
    normalize_pubmed,
    validate_evidence_record,
)

FIXTURES = Path(__file__).parent / "fixtures"
NOW = "2026-08-10T12:00:00Z"
SCOPE = MedicalScope(
    target="EGFR",
    disease="non-small cell lung cancer",
    disease_aliases=("NSCLC",),
    population="biomarker-selected adults",
)


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_scope_requires_target_and_disease() -> None:
    with pytest.raises(ValueError, match="target is required"):
        MedicalScope(target="", disease="NSCLC")
    with pytest.raises(ValueError, match="disease is required"):
        MedicalScope(target="EGFR", disease="")
    with pytest.raises(ValueError, match="date_from must use YYYY-MM-DD"):
        MedicalScope(target="EGFR", disease="NSCLC", date_from="2024")
    with pytest.raises(ValueError, match="date_from cannot be after date_to"):
        MedicalScope(
            target="EGFR",
            disease="NSCLC",
            date_from="2025-01-01",
            date_to="2024-12-31",
        )


def test_pubmed_normalization_preserves_source_and_missingness() -> None:
    rows = normalize_pubmed(
        _fixture("pubmed_esummary.json"),
        scope=SCOPE,
        query_id="pubmed-egfr-nsclc",
        retrieved_at=NOW,
    )

    assert len(rows) == 2
    row = rows[0]
    assert isinstance(row, EvidenceRecord)
    assert row.source_type == "pubmed"
    assert row.source_id == "12345678"
    assert row.canonical_url == "https://pubmed.ncbi.nlm.nih.gov/12345678/"
    assert row.target_submitted == "EGFR"
    assert row.disease_submitted == "non-small cell lung cancer"
    assert row.scope_population == "biomarker-selected adults"
    assert row.population_or_model is None
    assert row.sample_size is None
    assert row.result_direction is None
    assert row.source_locator == "result.12345678"
    assert row.identifiers["doi"] == "10.1000/example.1"


def test_pubmed_normalization_deduplicates_source_ids_stably() -> None:
    payload = _fixture("pubmed_esummary.json")
    payload["result"]["uids"].append("12345678")

    rows = normalize_pubmed(
        payload,
        scope=SCOPE,
        query_id="q1",
        retrieved_at=NOW,
    )

    assert [row.source_id for row in rows] == ["12345678", "87654321"]


def test_trial_normalization_does_not_turn_registration_into_efficacy() -> None:
    rows = normalize_clinical_trials(
        _fixture("clinical_trials_v2.json"),
        scope=SCOPE,
        query_id="ct-egfr-nsclc",
        retrieved_at=NOW,
    )

    assert len(rows) == 1
    row = rows[0]
    assert row.source_type == "clinical_trials"
    assert row.source_id == "NCT01234567"
    assert row.canonical_url == "https://clinicaltrials.gov/study/NCT01234567"
    assert row.status == "RECRUITING"
    assert row.evidence_class == "clinical"
    assert row.study_design == "INTERVENTIONAL; PHASE2"
    assert row.sample_size == 120
    assert row.intervention_or_exposure == "Example EGFR inhibitor"
    assert row.comparator == "Standard therapy"
    assert row.endpoint == "Progression-free survival"
    assert row.follow_up == "24 months"
    assert row.scope_population == "biomarker-selected adults"
    assert row.population_or_model == "ALL; 18 Years; N/A"
    assert row.registry_last_update == "2026-07-15"
    assert row.data_cutoff is None
    assert row.result_direction is None
    assert row.has_results is False


def test_evidence_record_serializes_without_tuple_or_path_values() -> None:
    row = normalize_clinical_trials(
        _fixture("clinical_trials_v2.json"),
        scope=SCOPE,
        query_id="q2",
        retrieved_at=NOW,
    )[0]

    payload = row.to_dict()

    assert payload["target_aliases"] == []
    assert payload["disease_aliases"] == ["NSCLC"]
    json.dumps(payload)


def test_validation_rejects_missing_source_identity() -> None:
    row = EvidenceRecord(
        schema_version=1,
        record_id="pubmed:",
        source_type="pubmed",
        source_id="",
        canonical_url="",
        retrieved_at=NOW,
        query_id="q1",
        title="Missing source",
        target_submitted="EGFR",
        disease_submitted="NSCLC",
    )

    issues = validate_evidence_record(row)

    assert "source_id is required" in issues
    assert "canonical_url is required" in issues

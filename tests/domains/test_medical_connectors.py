from __future__ import annotations

from pathlib import Path
from urllib.error import URLError

from argus_skill.verticals.medical.connectors import (
    build_clinical_trials_url,
    build_pubmed_search_url,
    fetch_clinical_trials,
    fetch_pubmed,
    medical_query_id,
)
from argus_skill.verticals.medical.evidence import MedicalScope

FIXTURES = Path(__file__).parent / "fixtures"
NOW = "2026-08-10T12:00:00Z"
SCOPE = MedicalScope(
    target="EGFR",
    disease="non-small cell lung cancer",
    disease_aliases=("NSCLC",),
)


def _raw(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


class Response:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.payload


def test_query_ids_are_human_readable_and_stable() -> None:
    assert medical_query_id("pubmed", SCOPE) == (
        "pubmed-egfr-non-small-cell-lung-cancer"
    )


def test_public_source_urls_preserve_target_and_disease_queries() -> None:
    pubmed = build_pubmed_search_url(SCOPE, retmax=25)
    trials = build_clinical_trials_url(SCOPE, page_size=25)

    assert "db=pubmed" in pubmed
    assert "retmax=25" in pubmed
    assert "EGFR" in pubmed
    assert "non-small+cell+lung+cancer" in pubmed
    assert "query.cond=non-small+cell+lung+cancer" in trials
    assert "query.intr=EGFR" in trials
    assert "pageSize=25" in trials


def test_public_source_urls_apply_iso_date_bounds() -> None:
    scope = MedicalScope(
        target="EGFR",
        disease="NSCLC",
        date_from="2020-01-01",
        date_to="2024-12-31",
    )

    pubmed = build_pubmed_search_url(scope)
    trials = build_clinical_trials_url(scope)

    assert "datetype=pdat" in pubmed
    assert "mindate=2020%2F01%2F01" in pubmed
    assert "maxdate=2024%2F12%2F31" in pubmed
    assert (
        "filter.advanced=AREA%5BStudyFirstPostDate%5DRANGE%5B"
        "2020-01-01%2C2024-12-31%5D"
    ) in trials


def test_fetch_pubmed_runs_search_then_summary_and_normalizes() -> None:
    payloads = iter([_raw("pubmed_esearch.json"), _raw("pubmed_esummary.json")])
    urls: list[str] = []

    def opener(request, timeout):
        urls.append(request.full_url)
        assert timeout == 30.0
        return Response(next(payloads))

    batch = fetch_pubmed(SCOPE, opener=opener, retrieved_at=NOW, retmax=25)

    assert len(urls) == 2
    assert "esearch.fcgi" in urls[0]
    assert "esummary.fcgi" in urls[1]
    assert "id=12345678%2C87654321" in urls[1]
    assert [row.source_id for row in batch.evidence] == ["12345678", "87654321"]
    assert len(batch.raw_payloads) == 2
    assert batch.failures == ()


def test_fetch_clinical_trials_normalizes_registry_record() -> None:
    def opener(_request, _timeout):
        return Response(_raw("clinical_trials_v2.json"))

    batch = fetch_clinical_trials(SCOPE, opener=opener, retrieved_at=NOW)

    assert [row.source_id for row in batch.evidence] == ["NCT01234567"]
    assert len(batch.raw_payloads) == 1
    assert batch.failures == ()


def test_transport_failure_is_not_biomedical_evidence() -> None:
    def opener(_request, _timeout):
        raise URLError("offline")

    batch = fetch_pubmed(SCOPE, opener=opener, retrieved_at=NOW)

    assert batch.evidence == ()
    assert batch.raw_payloads == ()
    assert len(batch.failures) == 1
    failure = batch.failures[0]
    assert failure.source_type == "pubmed"
    assert failure.error_type == "transport"
    assert failure.retryable is True


def test_parse_failure_is_retained_separately() -> None:
    def opener(_request, _timeout):
        return Response(b"not-json")

    batch = fetch_clinical_trials(SCOPE, opener=opener, retrieved_at=NOW)

    assert batch.evidence == ()
    assert len(batch.failures) == 1
    assert batch.failures[0].error_type == "parse"
    assert batch.failures[0].retryable is False

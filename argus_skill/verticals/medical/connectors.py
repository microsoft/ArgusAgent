"""Public PubMed and ClinicalTrials.gov connectors."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .evidence import (
    EvidenceRecord,
    MedicalScope,
    normalize_clinical_trials,
    normalize_pubmed,
)

_PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_CLINICAL_TRIALS_BASE = "https://clinicaltrials.gov/api/v2/studies"
_USER_AGENT = "Argus/0.1 medical-evidence-research"


@dataclass(frozen=True)
class RetrievalFailure:
    source_type: str
    query_id: str
    url: str
    retrieved_at: str
    error_type: str
    message: str
    retryable: bool


@dataclass(frozen=True)
class RetrievalBatch:
    source_type: str
    query_id: str
    query_urls: tuple[str, ...]
    raw_payloads: tuple[Mapping[str, Any], ...]
    evidence: tuple[EvidenceRecord, ...]
    failures: tuple[RetrievalFailure, ...]


def medical_query_id(source_type: str, scope: MedicalScope) -> str:
    values = (source_type, scope.target, scope.disease)
    parts = [re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-") for value in values]
    return "-".join(part for part in parts if part)


def _pubmed_clause(value: str, aliases: tuple[str, ...]) -> str:
    terms: list[str] = []
    seen: set[str] = set()
    for raw in (value, *aliases):
        term = raw.strip().replace('"', "")
        folded = term.casefold()
        if term and folded not in seen:
            seen.add(folded)
            terms.append(f'"{term}"[Title/Abstract]')
    return "(" + " OR ".join(terms) + ")"


def build_pubmed_search_url(scope: MedicalScope, *, retmax: int = 100) -> str:
    term = " AND ".join(
        (
            _pubmed_clause(scope.target, scope.target_aliases),
            _pubmed_clause(scope.disease, scope.disease_aliases),
        )
    )
    params = {
        "db": "pubmed",
        "retmode": "json",
        "retmax": max(1, min(int(retmax), 10_000)),
        "term": term,
    }
    if scope.date_from or scope.date_to:
        params["datetype"] = "pdat"
        if scope.date_from:
            params["mindate"] = scope.date_from.replace("-", "/")
        if scope.date_to:
            params["maxdate"] = scope.date_to.replace("-", "/")
    return f"{_PUBMED_BASE}/esearch.fcgi?{urlencode(params)}"


def _build_pubmed_summary_url(source_ids: tuple[str, ...]) -> str:
    params = {
        "db": "pubmed",
        "retmode": "json",
        "id": ",".join(source_ids),
    }
    return f"{_PUBMED_BASE}/esummary.fcgi?{urlencode(params)}"


def build_clinical_trials_url(scope: MedicalScope, *, page_size: int = 100) -> str:
    params = {
        "format": "json",
        "countTotal": "true",
        "pageSize": max(1, min(int(page_size), 1_000)),
        "query.cond": scope.disease,
        "query.intr": scope.target,
    }
    if scope.date_from or scope.date_to:
        lower = scope.date_from or "MIN"
        upper = scope.date_to or "MAX"
        params["filter.advanced"] = (
            f"AREA[StudyFirstPostDate]RANGE[{lower},{upper}]"
        )
    return f"{_CLINICAL_TRIALS_BASE}?{urlencode(params)}"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _default_open(request: Request, timeout: float):
    return urlopen(request, timeout=timeout)


def _fetch_json(
    url: str,
    *,
    opener: Callable[..., Any],
    timeout: float,
) -> Mapping[str, Any]:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": _USER_AGENT})
    with opener(request, timeout) as response:
        raw = response.read()
    payload = json.loads(raw.decode("utf-8"))
    if not isinstance(payload, Mapping):
        raise ValueError("source response is not a JSON object")
    return payload


def _retrieval_failure(
    source_type: str,
    query_id: str,
    url: str,
    retrieved_at: str,
    exc: BaseException,
) -> RetrievalFailure:
    if isinstance(exc, HTTPError):
        error_type = "http"
        retryable = exc.code == 429 or exc.code >= 500
    elif isinstance(exc, (TimeoutError, URLError, OSError)):
        error_type = "transport"
        retryable = True
    elif isinstance(exc, (json.JSONDecodeError, UnicodeDecodeError, ValueError)):
        error_type = "parse"
        retryable = False
    else:
        error_type = "unexpected"
        retryable = False
    return RetrievalFailure(
        source_type=source_type,
        query_id=query_id,
        url=url,
        retrieved_at=retrieved_at,
        error_type=error_type,
        message=f"{type(exc).__name__}: {exc}"[:1_000],
        retryable=retryable,
    )


def fetch_pubmed(
    scope: MedicalScope,
    *,
    opener: Callable[..., Any] | None = None,
    retrieved_at: str | None = None,
    retmax: int = 100,
    timeout: float = 30.0,
) -> RetrievalBatch:
    timestamp = retrieved_at or _utc_now()
    query_id = medical_query_id("pubmed", scope)
    search_url = build_pubmed_search_url(scope, retmax=retmax)
    open_request = opener or _default_open
    try:
        search_payload = _fetch_json(
            search_url,
            opener=open_request,
            timeout=timeout,
        )
    except Exception as exc:  # noqa: BLE001 - classified below
        return RetrievalBatch(
            source_type="pubmed",
            query_id=query_id,
            query_urls=(search_url,),
            raw_payloads=(),
            evidence=(),
            failures=(
                _retrieval_failure("pubmed", query_id, search_url, timestamp, exc),
            ),
        )
    search_result = search_payload.get("esearchresult")
    raw_ids = search_result.get("idlist", ()) if isinstance(search_result, Mapping) else ()
    source_ids: list[str] = []
    seen: set[str] = set()
    for raw_id in raw_ids if isinstance(raw_ids, (list, tuple)) else ():
        source_id = str(raw_id or "").strip()
        if source_id and source_id not in seen:
            seen.add(source_id)
            source_ids.append(source_id)
    if not source_ids:
        return RetrievalBatch(
            source_type="pubmed",
            query_id=query_id,
            query_urls=(search_url,),
            raw_payloads=(search_payload,),
            evidence=(),
            failures=(),
        )
    summary_url = _build_pubmed_summary_url(tuple(source_ids))
    try:
        summary_payload = _fetch_json(
            summary_url,
            opener=open_request,
            timeout=timeout,
        )
    except Exception as exc:  # noqa: BLE001 - classified below
        return RetrievalBatch(
            source_type="pubmed",
            query_id=query_id,
            query_urls=(search_url, summary_url),
            raw_payloads=(search_payload,),
            evidence=(),
            failures=(
                _retrieval_failure("pubmed", query_id, summary_url, timestamp, exc),
            ),
        )
    return RetrievalBatch(
        source_type="pubmed",
        query_id=query_id,
        query_urls=(search_url, summary_url),
        raw_payloads=(search_payload, summary_payload),
        evidence=normalize_pubmed(
            summary_payload,
            scope=scope,
            query_id=query_id,
            retrieved_at=timestamp,
        ),
        failures=(),
    )


def fetch_clinical_trials(
    scope: MedicalScope,
    *,
    opener: Callable[..., Any] | None = None,
    retrieved_at: str | None = None,
    page_size: int = 100,
    timeout: float = 30.0,
) -> RetrievalBatch:
    timestamp = retrieved_at or _utc_now()
    query_id = medical_query_id("clinical-trials", scope)
    url = build_clinical_trials_url(scope, page_size=page_size)
    open_request = opener or _default_open
    try:
        payload = _fetch_json(url, opener=open_request, timeout=timeout)
    except Exception as exc:  # noqa: BLE001 - classified below
        return RetrievalBatch(
            source_type="clinical_trials",
            query_id=query_id,
            query_urls=(url,),
            raw_payloads=(),
            evidence=(),
            failures=(
                _retrieval_failure(
                    "clinical_trials", query_id, url, timestamp, exc
                ),
            ),
        )
    return RetrievalBatch(
        source_type="clinical_trials",
        query_id=query_id,
        query_urls=(url,),
        raw_payloads=(payload,),
        evidence=normalize_clinical_trials(
            payload,
            scope=scope,
            query_id=query_id,
            retrieved_at=timestamp,
        ),
        failures=(),
    )

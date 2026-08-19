"""Integrity checks that hold regardless of what a prompt says.

Each case is something the reviewer skills currently ask a model to notice.
Asking works until the model is tired, the context is full, or the
verification profile was relaxed — which is exactly when it matters.
"""
from __future__ import annotations

import pytest

from argus_skill.verticals.research.integrity_gate import (
    bib_entries,
    citation_integrity,
    cited_keys,
    scorer_integrity,
)

BIB = """
@article{smith2024,
  author = {Smith, Jane and Doe, John},
  title  = {A Real Paper},
  year   = {2024},
  journal = {Journal of Things},
}

@inproceedings{lee2023,
  author = {Lee, Ada},
  title  = {Another Real Paper},
  year   = {2023},
}
"""


def codes(issues):
    return [issue.code for issue in issues]


# -- parsing ----------------------------------------------------------------

def test_parses_entries_and_fields() -> None:
    entries = bib_entries(BIB)

    assert set(entries) == {"smith2024", "lee2023"}
    assert entries["smith2024"]["title"] == "A Real Paper"
    assert entries["smith2024"]["year"] == "2024"


def test_parses_nested_braces_in_a_title() -> None:
    entries = bib_entries(
        "@article{k, author={A}, title={On {BERT} and Friends}, year={2020}}"
    )

    assert entries["k"]["title"] == "On {BERT} and Friends"


def test_parses_quoted_field_values() -> None:
    entries = bib_entries('@article{k, author = "Smith, J", title = "T", year = "1999"}')

    assert entries["k"]["author"] == "Smith, J"


def test_collects_cited_keys_including_multi_key_commands() -> None:
    assert cited_keys(r"text \cite{a,b} more \citep{c} \citet[p.~2]{d}") == [
        "a", "b", "c", "d",
    ]


def test_ignores_commented_out_citations() -> None:
    assert cited_keys("visible \\cite{a}\n% hidden \\cite{b}\n") == ["a"]


def test_escaped_percent_is_not_a_comment() -> None:
    assert cited_keys(r"95\% agreement \cite{a}") == ["a"]


# -- the check that matters most -------------------------------------------

def test_a_citation_with_no_entry_is_a_blocker() -> None:
    issues = citation_integrity([r"\cite{ghost2025}"], BIB)

    assert "unresolved_citation" in codes(issues)
    assert issues[0].blocking


def test_resolving_citations_pass() -> None:
    assert citation_integrity([r"\cite{smith2024} \cite{lee2023}"], BIB) == []


# -- entries a reader cannot look up ---------------------------------------

@pytest.mark.parametrize("missing", ["author", "title", "year"])
def test_missing_required_field_is_a_blocker(missing) -> None:
    fields = {"author": "{A}", "title": "{T}", "year": "{2020}"}
    fields.pop(missing)
    body = ", ".join(f"{k} = {v}" for k, v in fields.items())

    issues = citation_integrity([r"\cite{k}"], "@article{k, " + body + "}")

    assert "incomplete_bib_entry" in codes(issues)
    assert any(missing in issue.message for issue in issues)


def test_truncated_author_list_is_a_blocker() -> None:
    # Renders as "and 1 others" — a truncation artifact, not an author list.
    issues = citation_integrity(
        [r"\cite{k}"],
        "@article{k, author={Smith, J and others}, title={T}, year={2020}}",
    )

    assert "truncated_author_list" in codes(issues)


def test_et_al_in_the_author_field_is_a_blocker() -> None:
    issues = citation_integrity(
        [r"\cite{k}"],
        "@article{k, author={Smith, J et al.}, title={T}, year={2020}}",
    )

    assert "truncated_author_list" in codes(issues)


def test_a_real_author_list_is_accepted() -> None:
    issues = citation_integrity(
        [r"\cite{k}"],
        "@article{k, author={Smith, J and Doe, A and Roe, R}, title={T}, year={2020}}",
    )

    assert issues == []


@pytest.mark.parametrize("marker", ["VERIFY_CITATION", "UNVERIFIED", "TODO", "REPLACE"])
def test_unverified_markers_are_blockers(marker) -> None:
    issues = citation_integrity(
        [r"\cite{k}"],
        "@article{k, author={A}, title={" + marker + " me}, year={2020}}",
    )

    assert "unverified_bib_entry" in codes(issues)


def test_duplicate_keys_are_a_blocker() -> None:
    doubled = (
        "@article{k, author={A}, title={T}, year={2020}}\n"
        "@article{k, author={B}, title={U}, year={2021}}\n"
    )

    assert "duplicate_bib_key" in codes(citation_integrity([r"\cite{k}"], doubled))


# -- advisory ---------------------------------------------------------------

def test_uncited_entries_are_advisory_and_opt_in() -> None:
    # Padding a reference list is a quality signal, not a fabrication.
    assert citation_integrity([r"\cite{smith2024}"], BIB) == []

    issues = citation_integrity(
        [r"\cite{smith2024}"], BIB, require_all_entries_cited=True
    )

    assert codes(issues) == ["uncited_bib_entry"]
    assert not issues[0].blocking


def test_blockers_sort_before_advisories() -> None:
    issues = citation_integrity(
        [r"\cite{ghost}"], BIB, require_all_entries_cited=True
    )

    assert issues[0].blocking
    assert not issues[-1].blocking


# -- scorers ----------------------------------------------------------------

def test_a_constant_scorer_is_a_blocker() -> None:
    issues = scorer_integrity([0.85, 0.85, 0.85, 0.85])

    assert codes(issues) == ["constant_scorer"]
    assert issues[0].blocking


def test_all_zeros_is_a_constant_scorer() -> None:
    assert codes(scorer_integrity([0.0] * 5)) == ["constant_scorer"]


def test_a_discriminating_scorer_passes() -> None:
    assert scorer_integrity([0.1, 0.5, 0.9, 0.4]) == []


def test_too_few_samples_draws_no_conclusion() -> None:
    # Two equal scores are a coincidence, not evidence of a broken scorer.
    assert scorer_integrity([1.0, 1.0]) == []


def test_sample_threshold_is_configurable() -> None:
    assert codes(scorer_integrity([1.0, 1.0], min_samples=2)) == ["constant_scorer"]


def test_near_identical_scores_count_as_constant() -> None:
    assert codes(scorer_integrity([0.5, 0.5 + 1e-15, 0.5], tolerance=1e-12)) == [
        "constant_scorer"
    ]


def test_the_label_appears_in_the_message() -> None:
    issues = scorer_integrity([1.0] * 4, label="exact-match")

    assert "exact-match" in issues[0].message

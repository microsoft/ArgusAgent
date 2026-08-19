from __future__ import annotations

import json
from pathlib import Path


def test_operator_rewrites_expose_result_reason_and_next_action() -> None:
    path = (
        Path(__file__).parents[1]
        / "docs"
        / "evaluations"
        / "ARGUS_P1_05_OUTPUT_REVIEW_2026-08-08.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert len(payload["cases"]) >= 5
    for case in payload["cases"]:
        after = case["after"]
        assert after.strip() not in {"GO", "REVISE", "BLOCKED"}
        assert any(
            marker in after
            for marker in ("Reason:", "because", "so the", "D128", "runner")
        ), case["id"]
        assert any(
            marker in after
            for marker in ("Next:", "Your decision", "no user action", "should Argus")
        ), case["id"]
        assert "AUTHORITY_IMPACT" not in after
        assert "Reviewer returned" not in after

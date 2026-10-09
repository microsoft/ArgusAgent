from __future__ import annotations

from pathlib import Path

import pytest

from argus_skill.core.token_usage import extract_token_usage
from argus_skill.core.usage import UsageLedger, build_usage_record


@pytest.mark.parametrize(
    ("fresh_tokens", "cached_tokens", "cache_write_tokens", "output_tokens"),
    [
        (14_911, 14_336, 0, 233),
        (7_361, 23_040, 0, 580),
        (10, 0, 0, 2),
        (10, 0, 5, 2),
    ],
)
def test_cursor_result_normalizes_and_persists_cache_usage(
    fresh_tokens: int,
    cached_tokens: int,
    cache_write_tokens: int,
    output_tokens: int,
    tmp_path: Path,
) -> None:
    # The first two rows are sanitized CLI results; the others exercise zeros/writes.
    events = [{
        "type": "result",
        "subtype": "success",
        "usage": {
            "inputTokens": fresh_tokens,
            "outputTokens": output_tokens,
            "cacheReadTokens": cached_tokens,
            "cacheWriteTokens": cache_write_tokens,
        },
    }]
    usage = extract_token_usage(events)
    assert usage.input_tokens == fresh_tokens + cached_tokens + cache_write_tokens
    assert usage.output_tokens == output_tokens
    assert usage.cached_input_tokens_present
    assert usage.cached_input_tokens == cached_tokens
    assert usage.cache_write_tokens_present
    assert usage.cache_write_tokens == cache_write_tokens
    assert usage.source == "cursor_result"
    assert events[0]["usage"]["inputTokens"] == fresh_tokens

    ledger = UsageLedger(tmp_path, migrate_legacy=False)
    record = build_usage_record(
        call_id="cursor-cache",
        project_root=tmp_path,
        mission_id=None,
        provider="cursor",
        model="Grok 4.6 Extra High",
        run_label="engineer",
        started_at=1.0,
        completed_at=2.0,
        status="completed",
        token_usage=usage,
    )
    assert ledger.append(record)
    saved = ledger.records()[0]
    assert saved.input_tokens == usage.input_tokens
    assert saved.cached_input_tokens == cached_tokens
    assert saved.cache_write_tokens == cache_write_tokens
    assert saved.model == "Grok 4.6 Extra High"
    assert saved.cost_usd is None and saved.pricing_status == "unpriced"


@pytest.mark.parametrize("cache_write_tokens", [0, 500])
def test_codex_turn_preserves_reported_cache_writes(cache_write_tokens: int) -> None:
    usage = extract_token_usage([{
        "type": "turn.completed",
        "usage": {
            "input_tokens": 20_218,
            "cached_input_tokens": 13_824,
            "cache_write_input_tokens": cache_write_tokens,
            "output_tokens": 9,
            "reasoning_output_tokens": 0,
        },
    }])
    assert usage.input_tokens == 20_218
    assert usage.cached_input_tokens == 13_824
    assert usage.cache_write_tokens_present
    assert usage.cache_write_tokens == cache_write_tokens
    assert usage.output_tokens == 9
    assert usage.source == "cumulative"


def test_omitted_cache_fields_remain_unknown() -> None:
    usage = extract_token_usage([{
        "type": "result",
        "usage": {"inputTokens": 14_911, "outputTokens": 233},
    }])
    assert usage.complete
    assert not usage.cached_input_tokens_present
    assert not usage.cache_write_tokens_present


@pytest.mark.parametrize("input_alias", ["input_tokens", "prompt_tokens"])
def test_canonical_counts_take_precedence_over_new_cache_aliases(input_alias: str) -> None:
    usage = extract_token_usage([{
        "type": "result",
        "usage": {
            input_alias: 100,
            "inputTokens": 30,
            "cached_input_tokens": 5,
            "cacheReadTokens": 20,
            "cache_write_tokens": 0,
            "cache_write_input_tokens": 7,
            "output_tokens": 10,
        },
    }])
    assert usage.input_tokens == 100
    assert usage.cached_input_tokens == 5
    assert usage.cache_write_tokens_present and usage.cache_write_tokens == 0
    assert usage.source == "cumulative"

"""Tests for the setup wizard's GPU keep-alive (anti-reclaim) integration."""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from argus_skill.tools import gpu_load
from argus_skill.tools import setup as _wizard


def test_setup_creates_trusted_default_house_rules(tmp_path: Path, monkeypatch) -> None:
    sp_dir = tmp_path / "special_prompts"
    monkeypatch.setenv("ARGUS_SKILL_SPECIAL_PROMPTS_DIR", str(sp_dir))
    from argus_skill.life import special_prompts

    path = _wizard._ensure_default_house_rules_prompt()

    assert path == sp_dir / "10-house-rules.md"
    assert path is not None
    if os.name != "nt":
        assert (path.stat().st_mode & 0o777) == 0o644
    assert "unrelated jobs" in path.read_text(encoding="utf-8")
    assert special_prompts.describe_special_prompt_gate() == (True, "")


def test_setup_preserves_existing_trusted_house_rules(
    tmp_path: Path, monkeypatch
) -> None:
    sp_dir = tmp_path / "special_prompts"
    monkeypatch.setenv("ARGUS_SKILL_SPECIAL_PROMPTS_DIR", str(sp_dir))
    custom = _wizard._write_special_prompt(
        "05-operator-policy.md", "Keep operator-authored policy unchanged.\n"
    )

    assert _wizard._ensure_default_house_rules_prompt() is None
    assert custom.read_text(encoding="utf-8") == "Keep operator-authored policy unchanged.\n"
    assert list(sp_dir.glob("*.md")) == [custom]


def test_setup_does_not_overwrite_untrusted_house_rules(
    tmp_path: Path, monkeypatch
) -> None:
    sp_dir = tmp_path / "special_prompts"
    sp_dir.mkdir()
    monkeypatch.setenv("ARGUS_SKILL_SPECIAL_PROMPTS_DIR", str(sp_dir))
    existing = sp_dir / "10-house-rules.md"
    existing.write_text("Operator draft; do not overwrite.\n", encoding="utf-8")
    existing.chmod(0o666)

    generated = _wizard._ensure_default_house_rules_prompt()

    if os.name == "nt":
        assert generated is None
    else:
        assert generated == sp_dir / "10-house-rules-setup-1.md"
        assert generated is not None
        assert (generated.stat().st_mode & 0o022) == 0
    assert existing.read_text(encoding="utf-8") == "Operator draft; do not overwrite.\n"
    from argus_skill.life import special_prompts

    assert special_prompts.describe_special_prompt_gate() == (True, "")


def test_gpu_load_help_exits_clean() -> None:
    with pytest.raises(SystemExit) as exc:
        gpu_load.main(["--help"])
    assert exc.value.code == 0


def test_gpu_load_arg_defaults() -> None:
    args = gpu_load._parse_args([])
    assert args.util == 20.0
    assert args.mem == 10.0
    assert args.duration == 0.0
    args2 = gpu_load._parse_args(["--gpus", "0,2", "--mem", "5", "--util", "15"])
    assert args2.gpus == "0,2"
    assert args2.mem == 5.0
    assert args2.util == 15.0


def test_setup_defaults_to_only_installed_copilot(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("ARGUS_SKILL_HOME", str(tmp_path / "argus-home"))
    monkeypatch.delenv("ARGUS_SKILL_RUNNER_BACKEND", raising=False)
    monkeypatch.delenv("ARGUS_SKILL_LIFE_BACKEND", raising=False)
    monkeypatch.setattr(
        "argus_skill.agent_cli.runner_backend.resolve_runner_bin",
        lambda name: "/usr/local/bin/copilot" if name == "copilot" else None,
    )
    monkeypatch.setattr("builtins.input", lambda _prompt="": "")
    from argus_skill.core.knob_store import read_persisted_knobs

    assert _wizard._configure_runner_backend() == "copilot"
    assert "ARGUS_SKILL_RUNNER_BACKEND" not in read_persisted_knobs()


def test_setup_defaults_to_only_installed_pi(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ARGUS_SKILL_HOME", str(tmp_path / "argus-home"))
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("ARGUS_SKILL_RUNNER_BACKEND", raising=False)
    monkeypatch.delenv("ARGUS_SKILL_LIFE_BACKEND", raising=False)
    monkeypatch.setattr(
        "argus_skill.agent_cli.runner_backend.resolve_runner_bin",
        lambda name: "/usr/local/bin/pi" if name == "pi" else None,
    )
    monkeypatch.setattr("builtins.input", lambda _prompt="": "")
    from argus_skill.core.knob_store import read_persisted_knobs

    assert _wizard._configure_runner_backend() == "pi"
    assert "ARGUS_SKILL_RUNNER_BACKEND" not in read_persisted_knobs()


def test_setup_defaults_to_only_installed_opencode(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("ARGUS_SKILL_HOME", str(tmp_path / "argus-home"))
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("ARGUS_SKILL_RUNNER_BACKEND", raising=False)
    monkeypatch.delenv("ARGUS_SKILL_LIFE_BACKEND", raising=False)
    monkeypatch.setattr(
        "argus_skill.agent_cli.runner_backend.resolve_runner_bin",
        lambda name: "/usr/local/bin/opencode" if name == "opencode" else None,
    )
    monkeypatch.setattr("builtins.input", lambda _prompt="": "")
    from argus_skill.core.knob_store import read_persisted_knobs

    assert _wizard._configure_runner_backend() == "opencode"
    assert "ARGUS_SKILL_RUNNER_BACKEND" not in read_persisted_knobs()


def test_setup_rejects_selected_backend_missing_from_path(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("ARGUS_SKILL_HOME", str(tmp_path / "argus-home"))
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("ARGUS_SKILL_RUNNER_BACKEND", raising=False)
    monkeypatch.delenv("ARGUS_SKILL_LIFE_BACKEND", raising=False)
    monkeypatch.setattr(
        "argus_skill.agent_cli.runner_backend.resolve_runner_bin",
        lambda _name: None,
    )
    monkeypatch.setattr("builtins.input", lambda _prompt="": "copilot")
    from argus_skill.core.knob_store import read_persisted_knobs

    assert _wizard._configure_runner_backend() is None
    assert "ARGUS_SKILL_RUNNER_BACKEND" not in read_persisted_knobs()


def test_setup_does_not_replace_persisted_backend_before_readiness(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("ARGUS_SKILL_HOME", str(tmp_path / "argus-home"))
    monkeypatch.delenv("ARGUS_SKILL_RUNNER_BACKEND", raising=False)
    monkeypatch.delenv("ARGUS_SKILL_LIFE_BACKEND", raising=False)
    from argus_skill.core.knob_store import read_persisted_knobs, write_persisted_knob

    assert write_persisted_knob("ARGUS_SKILL_RUNNER_BACKEND", "codex")
    monkeypatch.setattr(
        "argus_skill.agent_cli.runner_backend.resolve_runner_bin",
        lambda name: "/usr/local/bin/copilot" if name == "copilot" else None,
    )
    monkeypatch.setattr("builtins.input", lambda _prompt="": "")

    assert _wizard._configure_runner_backend() == "copilot"
    assert read_persisted_knobs()["ARGUS_SKILL_RUNNER_BACKEND"] == "codex"



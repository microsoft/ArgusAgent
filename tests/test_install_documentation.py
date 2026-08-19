from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_readmes_document_the_supported_source_install() -> None:
    for name in ("README.md", "README.zh-CN.md"):
        text = (ROOT / name).read_text(encoding="utf-8")

        assert "technical_report/argus-technical-report.pdf" in text
        assert "python3 -m venv .venv" in text
        assert "pip install -e ." in text
        assert "argus --setup --non-interactive" in text
        assert "github.com/microsoft/ArgusAgent" in text
        assert "argus doctor --advisor none --verify" in text

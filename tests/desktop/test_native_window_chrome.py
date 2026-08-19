from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_windows_caption_buttons_use_native_non_client_frame() -> None:
    main = (ROOT / "desktop" / "src" / "main" / "index.ts").read_text(encoding="utf-8")
    css = (ROOT / "desktop" / "src" / "renderer" / "style.css").read_text(
        encoding="utf-8"
    )

    # Renderer coordinates must never share the Windows caption-button strip.
    assert "titleBarStyle: 'hidden'" not in main
    assert "titleBarOverlay:" not in main
    assert "native non-client frame" in main
    # The launcher used to reserve an in-renderer 38px overlay; it must remove
    # that fallback whenever the native frame marker is present.
    assert "data-argus-desktop-native-frame='true'] body" in css
    assert "data-argus-desktop-native-frame='true'] .wizard" in css


def test_installer_bypasses_close_to_tray_before_replacing_files() -> None:
    main = (ROOT / "desktop" / "src" / "main" / "index.ts").read_text(
        encoding="utf-8"
    )
    config = (ROOT / "desktop" / "electron-builder.yml").read_text(encoding="utf-8")
    include = (ROOT / "desktop" / "resources" / "installer.nsh").read_text(
        encoding="utf-8"
    )

    assert "query-session-end" in main
    assert "include: resources/installer.nsh" in config
    assert "!macro customCheckAppRunning" in include
    assert '!insertmacro forceStopArgus' in include
    assert '/IM "Argus.exe"' in include
    assert '/IM "argus-backend.exe"' in include
    assert 'DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"' in include
    assert 'DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"' in include


def test_release_build_keeps_checked_in_windows_icon_resources() -> None:
    workflow = (ROOT / ".github" / "workflows" / "release.yml").read_text(
        encoding="utf-8"
    )
    desktop_doc = (ROOT / "docs" / "windows-desktop.md").read_text(encoding="utf-8")

    # signAndEditExecutable=false skips icon/version resource edits entirely.
    # Disabling only signing keeps the original icon while still permitting CI
    # builds without a release certificate.
    assert "signAndEditExecutable=false" not in workflow
    assert "signExecutable=false" in workflow
    assert "signExecutable=false" in desktop_doc

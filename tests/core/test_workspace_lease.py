from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import time

import pytest

from argus_skill.core.workspace_lease import (
    WorkspaceLeaseBusy,
    acquire_workspace_lease,
    release_workspace_lease,
    workspace_lease_path,
)


def test_workspace_lease_path_exposes_canonical_workdir(tmp_path, monkeypatch) -> None:
    workspace = tmp_path / "nested" / "workspace"
    workspace.mkdir(parents=True)
    temp_root = tmp_path / "leases"
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(temp_root))

    path = workspace_lease_path(workspace)

    uid = os.getuid() if hasattr(os, "getuid") else 0
    expected_root = temp_root / f"argus-skill-workspaces-{uid}"
    if os.name == "nt":
        identity = os.path.normcase(str(workspace.resolve()))
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        assert path == expected_root / f"workspace-{digest[:32]}.lock"
    else:
        assert path == expected_root.joinpath(*workspace.resolve().parts[1:], "lease.lock")
    assert path.parent.is_dir()


def test_workspace_lease_is_exclusive_for_canonical_path(tmp_path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    first = acquire_workspace_lease(workspace, owner={"sid": "s-one"})
    try:
        with pytest.raises(WorkspaceLeaseBusy, match="s-one"):
            acquire_workspace_lease(workspace / ".", owner={"sid": "s-two"})
    finally:
        release_workspace_lease(first)

    second = acquire_workspace_lease(workspace, owner={"sid": "s-two"})
    release_workspace_lease(second)


def test_workspace_lease_is_exclusive_across_processes(tmp_path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    ready = tmp_path / "ready"
    script = (
        "from pathlib import Path\n"
        "import time\n"
        "from argus_skill.core.workspace_lease import acquire_workspace_lease\n"
        f"acquire_workspace_lease({str(workspace)!r}, owner={{'sid':'s-child'}})\n"
        f"Path({str(ready)!r}).write_text('ready', encoding='utf-8')\n"
        "time.sleep(1.0)\n"
    )
    child = subprocess.Popen(
        [sys.executable, "-c", script],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        deadline = time.monotonic() + 10
        while not ready.exists() and child.poll() is None and time.monotonic() < deadline:
            time.sleep(0.02)
        if not ready.exists():
            stdout, stderr = child.communicate(timeout=2)
            pytest.fail(f"lease holder failed to start: {stdout}\n{stderr}")
        with pytest.raises(WorkspaceLeaseBusy, match="s-child"):
            acquire_workspace_lease(workspace, owner={"sid": "s-parent"})
    finally:
        child.wait(timeout=10)

    lease = acquire_workspace_lease(workspace, owner={"sid": "s-parent"})
    release_workspace_lease(lease)

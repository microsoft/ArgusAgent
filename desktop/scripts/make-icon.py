"""Generate the Windows ICO from the repository's official Argus mark."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RESOURCES = ROOT / "desktop" / "resources"
ICON_SIZE = 1024


def official_mark(source: Path) -> Image.Image:
    """Load the official white-background mark without recolouring it."""
    mark = Image.open(source).convert("RGBA")
    if mark.size != (ICON_SIZE, ICON_SIZE):
        mark = mark.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
    return mark


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default=str(
            ROOT
            / "docs"
            / "assets"
            / "brand"
            / "png"
            / "white-background"
            / "marks"
            / "argus-mark-white-circle-1024.png"
        ),
        help="official high-resolution Argus mark PNG",
    )
    args = parser.parse_args()
    source = Path(args.source)
    if not source.is_file():
        raise SystemExit(f"icon master not found: {source}")
    RESOURCES.mkdir(parents=True, exist_ok=True)
    icon = official_mark(source)
    icon.save(
        RESOURCES / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"icon written to {RESOURCES / 'icon.ico'} from {source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

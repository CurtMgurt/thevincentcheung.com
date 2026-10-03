"""Create metadata-free previews from sanitized public images (requires Pillow)."""

import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


def webp(source: Path, destination: Path, max_edge: int, quality: int = 82) -> None:
    with Image.open(source) as image:
        resized = image.convert("RGB")
        resized.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        # Fresh pixels exclude source EXIF and other ancillary metadata.
        clean = Image.new("RGB", resized.size)
        clean.paste(resized)
        destination.parent.mkdir(parents=True, exist_ok=True)
        clean.save(destination, "WEBP", quality=quality, method=6)
    print(f"{destination.relative_to(ROOT)}: {clean.width}x{clean.height}, {destination.stat().st_size:,} bytes")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artwork-only", action="store_true", help="Regenerate artwork previews without changing hero images.")
    args = parser.parse_args()
    if not args.artwork_only:
        for size in (480, 800, 1200, 1448):
            webp(
                ROOT / "assets/vincent-spiderman-sanitized.png",
                ROOT / f"assets/hero/vincent-{size}.webp",
                size,
            )
    for slug in ("for-daddy", "pokemon-world", "pokemon-battle"):
        webp(
            ROOT / f"assets/art/{slug}.jpg",
            ROOT / f"assets/art/{slug}-preview.webp",
            800,
        )


if __name__ == "__main__":
    main()

"""Create web-sized assets from the already sanitized public artwork (requires Pillow)."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent


def webp(source: Path, destination: Path, width: int, quality: int = 82) -> None:
    with Image.open(source) as image:
        height = round(image.height * width / image.width)
        resized = image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        # Fresh pixels exclude source EXIF and other ancillary metadata.
        clean = Image.new("RGB", resized.size)
        clean.paste(resized)
        destination.parent.mkdir(parents=True, exist_ok=True)
        clean.save(destination, "WEBP", quality=quality, method=6)
    print(f"{destination.relative_to(ROOT)}: {width}x{height}, {destination.stat().st_size:,} bytes")


if __name__ == "__main__":
    for size in (480, 800, 1200, 1448):
        webp(
            ROOT / "assets/vincent-spiderman-sanitized.png",
            ROOT / f"assets/hero/vincent-{size}.webp",
            size,
        )
    webp(ROOT / "assets/art/for-daddy.jpg", ROOT / "assets/art/for-daddy-preview.webp", 320)

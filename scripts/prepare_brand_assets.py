"""Build icons and a social preview from the existing public artwork (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PAPER = "#fbf8ef"
TEAL = "#306661"
CORAL = "#cb6759"


def font(size, bold=False):
    path = Path("C:/Windows/Fonts") / ("segoeuib.ttf" if bold else "segoeui.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)


icon = Image.new("RGB", (720, 720), PAPER)
draw = ImageDraw.Draw(icon)
draw.line([(100, 190), (220, 540), (340, 190)], fill=CORAL, width=70, joint="curve")
draw.arc((290, 155, 625, 555), 48, 312, fill=TEAL, width=70)
for name, size in [("favicon-32.png", 32), ("apple-touch-icon.png", 180)]:
    icon.resize((size, size), Image.Resampling.LANCZOS).save(ASSETS / name)

card = Image.new("RGB", (1200, 630), PAPER)
draw = ImageDraw.Draw(card)
draw.text((42, 34), "Vincent's drawings", font=font(68, True), fill=TEAL)
draw.text((45, 120), "Drawings, handmade cards, and little surprises.", font=font(25), fill="#575b55")
for index, (name, tape) in enumerate([
    ("fei-green-hearts-preview.webp", "#e5b748"),
    ("purple-notebook-creatures-preview.webp", "#55bdb8"),
    ("numbered-creatures-bus-preview.webp", "#e66f5c"),
]):
    x = 42 + index * 378
    draw.rectangle((x + 4, 194, x + 360, 596), fill="#e8e3d9")
    draw.rectangle((x, 190, x + 356, 590), fill="#fffdf8", outline="#d8d3c8", width=2)
    with Image.open(ASSETS / "art" / name) as opened:
        artwork = opened.convert("RGB")
        artwork.thumbnail((326, 366), Image.Resampling.LANCZOS)
        card.paste(artwork, (x + (356 - artwork.width) // 2, 205 + (366 - artwork.height) // 2))
    draw.rectangle((x + 130, 177, x + 226, 201), fill=tape)
card.save(ASSETS / "share-card.jpg", "JPEG", quality=90, optimize=True)
print("Built favicon, touch icon, and 1200x630 social preview.")

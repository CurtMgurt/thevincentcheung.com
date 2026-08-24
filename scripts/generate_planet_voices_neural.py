"""Generate the site's friendly, single-voice planet-name clips.

Requires ``edge-tts``.  The few uncommon names use ordinary-word homophones
instead of hyphenated spelling hints, because some speech engines read short
chunks such as "keh" or "iss" as individual letters.
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

import edge_tts


VOICE = "en-US-AnaNeural"
RATE = "+4%"
PITCH = "+3Hz"

# These phrases are intentionally what the voice hears, not visible site copy.
# series  -> Ceres, heiress -> Eris, mock eh -> MAH-keh.
SPOKEN = {
    "sun": "Sun!",
    "mercury": "Mercury!",
    "venus": "Venus!",
    "earth": "Earth!",
    "mars": "Mars!",
    "ceres": "Series!",
    "jupiter": "Jupiter!",
    "saturn": "Saturn!",
    "uranus": "Uranus!",
    "neptune": "Neptune!",
    "pluto": "Pluto!",
    "haumea": "How may uh!",
    "makemake": "Mock eh, mock eh!",
    "eris": "Heiress!",
}


async def generate(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for slug, spoken in SPOKEN.items():
        destination = output_dir / f"{slug}.mp3"
        speech = edge_tts.Communicate(
            spoken,
            VOICE,
            rate=RATE,
            pitch=PITCH,
        )
        await speech.save(str(destination))
        if destination.stat().st_size < 1_000:
            raise RuntimeError(f"Speech service returned an empty clip: {destination}")
        print(f"{slug:<10} {destination.stat().st_size:>7} bytes  {spoken}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "assets" / "planet-voices",
    )
    args = parser.parse_args()
    asyncio.run(generate(args.output_dir))


if __name__ == "__main__":
    main()

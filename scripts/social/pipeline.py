"""Point d'entrée CLI : contenu (JSON) + images -> post.jpg + reel.mp4 + caption.txt.

Usage:
  python pipeline.py --content content.json --images img1.jpg img2.jpg img3.jpg
                      --slug some-article-slug [--voice-id XXXX] [--output-dir path]

content.json attendu (généré par le skill /article, pas par ce script) :
  {"caption": "...", "reel_script": ["phrase 1", "phrase 2", ...], "post_title": "..."}
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ADMIN_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "output"

# Doit être chargé AVANT les imports ci-dessous : le SDK elevenlabs lit
# ELEVENLABS_API_KEY comme valeur par défaut d'argument, évaluée à l'import
# du module (donc trop tard si load_dotenv tourne après l'import).
load_dotenv(ADMIN_ROOT / ".env.local")

from checks import PrereqError, check_env, check_ffmpeg
from voiceover import generate_voiceover
from subtitles import build_subtitles
from video import build_reel
from post_image import build_post_image

# Voix ElevenLabs par défaut ; surchargeable via --voice-id ou la variable
# d'env ELEVEN_VOICE_ID.
DEFAULT_VOICE_ID = "IKne3meq5aSn9XLyUdCD"  # Charlie, premade (utilisable en plan gratuit)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content", required=True, type=Path)
    parser.add_argument("--images", required=True, nargs="+", type=Path)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--voice-id", default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    return parser.parse_args()


def resolve_voice_id(cli_value: str | None) -> str:
    voice_id = cli_value or os.environ.get("ELEVEN_VOICE_ID") or DEFAULT_VOICE_ID
    if not voice_id:
        raise PrereqError(
            "Aucun voice_id ElevenLabs fourni (--voice-id, variable ELEVEN_VOICE_ID, "
            "ou DEFAULT_VOICE_ID dans pipeline.py)."
        )
    return voice_id


def run(content_path: Path, images: list[Path], slug: str,
        voice_id_arg: str | None, output_dir: Path | None) -> Path:
    check_ffmpeg()
    check_env("ELEVENLABS_API_KEY")
    voice_id = resolve_voice_id(voice_id_arg)

    for img in images:
        if not img.exists():
            raise PrereqError(f"Image introuvable : {img}")

    content = json.loads(content_path.read_text(encoding="utf-8"))

    out_dir = output_dir or (DEFAULT_OUTPUT_ROOT / slug)
    out_dir.mkdir(parents=True, exist_ok=True)

    audio_path = out_dir / "voiceover.mp3"
    segments = generate_voiceover(content["reel_script"], voice_id, audio_path)

    ass_path = out_dir / "subtitles.ass"
    build_subtitles(segments, ass_path)

    total_duration = segments[-1]["end"]
    reel_path = out_dir / "reel.mp4"
    build_reel(images, audio_path, ass_path, reel_path, total_duration, work_dir=out_dir)

    post_path = out_dir / "post.jpg"
    build_post_image(images[0], content["post_title"], post_path)

    caption_path = out_dir / "caption.txt"
    caption_path.write_text(content["caption"], encoding="utf-8")

    print(f"Fichiers générés dans {out_dir} :")
    print(f"  - {post_path.name}")
    print(f"  - {reel_path.name}")
    print(f"  - {caption_path.name}")

    return out_dir


def main() -> None:
    args = parse_args()
    try:
        run(args.content, args.images, args.slug, args.voice_id, args.output_dir)
    except PrereqError as e:
        print(f"Erreur : {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

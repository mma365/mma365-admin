"""
Pipeline de génération automatique : article -> caption Instagram + reel vidéo.

Étapes :
  1. Claude API        -> génère la caption + le script du reel (JSON)
  2. ElevenLabs API     -> génère la voix off + timestamps par caractère
  3. build_subtitles()  -> construit un fichier .ass à partir des timestamps
  4. build_reel()       -> assemble les images (zoom/dézoom) + voix off + sous-titres via ffmpeg
  5. build_post_image() -> génère l'image du post carré/portrait avec Pillow

Prérequis :
  pip install anthropic elevenlabs pillow --break-system-packages
  ffmpeg installé et dans le PATH

Variables d'environnement attendues :
  ANTHROPIC_API_KEY
  ELEVENLABS_API_KEY
"""

import os
import json
import subprocess
from pathlib import Path

import anthropic
from elevenlabs.client import ElevenLabs
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

OUTPUT_DIR = Path("./output")
OUTPUT_DIR.mkdir(exist_ok=True)

ELEVEN_VOICE_ID = "REMPLACE_PAR_TON_VOICE_ID"  # voix FR choisie sur ElevenLabs
REEL_WIDTH, REEL_HEIGHT = 1080, 1920  # format 9:16 imposé par Instagram Reels

anthropic_client = anthropic.Anthropic()  # lit ANTHROPIC_API_KEY dans l'env
eleven_client = ElevenLabs()  # lit ELEVENLABS_API_KEY dans l'env


# ---------------------------------------------------------------------------
# 1. GÉNÉRATION DU CONTENU (caption + script du reel)
# ---------------------------------------------------------------------------

def generate_content(article_text: str) -> dict:
    """Demande à Claude de générer caption + script de reel en JSON structuré."""

    prompt = f"""Voici un article MMA/UFC. Génère UNIQUEMENT un objet JSON (aucun texte
avant/après, aucun ```), avec cette structure exacte :

{{
  "caption": "légende Instagram punchy, avec un hook en première ligne, 2-4 phrases,
              puis 5-8 hashtags MMA/UFC pertinents",
  "reel_script": [
    "phrase 1 courte, percutante, pour ouvrir le reel",
    "phrase 2",
    "phrase 3",
    "..."
  ],
  "post_title": "titre court pour l'image du post (5-8 mots max)"
}}

Contraintes pour reel_script :
- 5 à 9 phrases courtes (8-15 mots chacune), rythme oral, pas de sous-phrases avec virgules multiples
- Doit pouvoir être lu à voix haute en 30-45 secondes au total
- Reprend les faits clés de l'article, sans les citer mot pour mot

Article :
{article_text}
"""

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    return json.loads(raw)


# ---------------------------------------------------------------------------
# 2. VOIX OFF + TIMESTAMPS (ElevenLabs)
# ---------------------------------------------------------------------------

def generate_voiceover(script_lines: list[str], out_audio: Path) -> list[dict]:
    """
    Génère la voix off pour tout le script d'un coup et récupère les timestamps
    par caractère (character_start_times_seconds), qu'on regroupe ensuite par phrase.
    Retourne une liste de dicts : [{"text": ..., "start": ..., "end": ...}, ...]
    """
    full_text = " ".join(script_lines)

    result = eleven_client.text_to_speech.convert_with_timestamps(
        voice_id=ELEVEN_VOICE_ID,
        text=full_text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    audio_bytes = result.audio_base64  # selon version du SDK, peut être déjà bytes
    with open(out_audio, "wb") as f:
        f.write(audio_bytes)

    chars = result.alignment.characters
    starts = result.alignment.character_start_times_seconds
    ends = result.alignment.character_end_times_seconds

    # Reconstitue les timings par phrase en avançant dans le texte concaténé
    subtitle_segments = []
    cursor = 0
    for line in script_lines:
        line_len = len(line)
        seg_start = starts[cursor]
        seg_end = ends[min(cursor + line_len - 1, len(ends) - 1)]
        subtitle_segments.append({"text": line, "start": seg_start, "end": seg_end})
        cursor += line_len + 1  # +1 pour l'espace ajouté par join()

    return subtitle_segments


# ---------------------------------------------------------------------------
# 3. FICHIER SOUS-TITRES (.ass)
# ---------------------------------------------------------------------------

def _sec_to_ass_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_subtitles(segments: list[dict], out_ass: Path):
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, Bold, Alignment, MarginV
Style: Default,Arial Black,64,&H00FFFFFF,&H00000000,1,2,220

[Events]
Format: Layer, Start, End, Style, Text
"""
    lines = [header]
    for seg in segments:
        start = _sec_to_ass_time(seg["start"])
        end = _sec_to_ass_time(seg["end"])
        text = seg["text"].replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{start},{end},Default,{text}\n")

    out_ass.write_text("".join(lines), encoding="utf-8")


# ---------------------------------------------------------------------------
# 4. ASSEMBLAGE DU REEL (ffmpeg : zoom/dézoom + audio + sous-titres)
# ---------------------------------------------------------------------------

def build_reel(images: list[Path], audio_path: Path, ass_path: Path,
                out_video: Path, total_duration: float):
    """
    Enchaîne les images avec un effet Ken Burns (zoom in/out en alternance),
    calé sur la durée totale de l'audio, puis burn les sous-titres et mixe la voix off.
    """
    n = len(images)
    per_image_duration = total_duration / n
    fps = 30

    filter_parts = []
    inputs = []
    for i, img in enumerate(images):
        inputs += ["-loop", "1", "-t", str(per_image_duration), "-i", str(img)]
        zoom_dir = "in" if i % 2 == 0 else "out"
        if zoom_dir == "in":
            zexpr = "zoom+0.0015"
        else:
            zexpr = "if(eq(on,1),1.15,zoom-0.0015)"  # part zoomé, dézoome progressivement
        filter_parts.append(
            f"[{i}:v]scale=8000:-1,zoompan=z='{zexpr}':d={int(per_image_duration*fps)}"
            f":s={REEL_WIDTH}x{REEL_HEIGHT}:fps={fps},setsar=1[v{i}]"
        )

    concat_inputs = "".join(f"[v{i}]" for i in range(n))
    filter_parts.append(f"{concat_inputs}concat=n={n}:v=1:a=0[vconcat]")
    filter_parts.append(f"[vconcat]ass={ass_path}[vout]")

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-i", str(audio_path),
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", f"{n}:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        str(out_video),
    ]
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------------------
# 5. IMAGE DU POST (Pillow)
# ---------------------------------------------------------------------------

def build_post_image(background_photo: Path, title: str, out_image: Path,
                      size=(1080, 1350)):
    img = Image.open(background_photo).convert("RGB").resize(size)
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # bandeau semi-transparent en bas pour la lisibilité du titre
    band_height = 320
    draw.rectangle(
        [(0, size[1] - band_height), (size[0], size[1])],
        fill=(0, 0, 0, 160),
    )

    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 56)
    draw.text((50, size[1] - band_height + 40), title, font=font, fill="white")

    combined = Image.alpha_composite(img.convert("RGBA"), overlay)
    combined.convert("RGB").save(out_image, quality=95)


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def run_pipeline(article_text: str, fighter_images: list[Path], main_photo: Path):
    content = generate_content(article_text)
    print("Caption générée :\n", content["caption"])

    audio_path = OUTPUT_DIR / "voiceover.mp3"
    segments = generate_voiceover(content["reel_script"], audio_path)

    ass_path = OUTPUT_DIR / "subtitles.ass"
    build_subtitles(segments, ass_path)

    total_duration = segments[-1]["end"]
    reel_path = OUTPUT_DIR / "reel.mp4"
    build_reel(fighter_images, audio_path, ass_path, reel_path, total_duration)

    post_path = OUTPUT_DIR / "post.jpg"
    build_post_image(main_photo, content["post_title"], post_path)

    (OUTPUT_DIR / "caption.txt").write_text(content["caption"], encoding="utf-8")

    print(f"\nFichiers générés dans {OUTPUT_DIR}/ :")
    print(f"  - {post_path.name} (post)")
    print(f"  - {reel_path.name} (reel)")
    print(f"  - caption.txt (à copier-coller)")


if __name__ == "__main__":
    ARTICLE = """Colle ici le texte de ton article."""
    run_pipeline(
        article_text=ARTICLE,
        fighter_images=[Path("images/img1.jpg"), Path("images/img2.jpg"), Path("images/img3.jpg")],
        main_photo=Path("images/img1.jpg"),
    )
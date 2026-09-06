"""Voix off + timestamps par caractère via l'API ElevenLabs (pas de Whisper :
on utilise directement l'alignement renvoyé par ElevenLabs)."""

import base64
from pathlib import Path

from elevenlabs.client import ElevenLabs

MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"


def generate_voiceover(script_lines: list[str], voice_id: str, out_audio: Path) -> list[dict]:
    """Génère la voix off pour tout le script d'un coup, regroupe les timestamps
    par phrase. Retourne [{"text": ..., "start": ..., "end": ...}, ...]."""
    client = ElevenLabs()  # lit ELEVENLABS_API_KEY dans l'env
    full_text = " ".join(script_lines)

    result = client.text_to_speech.convert_with_timestamps(
        voice_id=voice_id,
        text=full_text,
        model_id=MODEL_ID,
        output_format=OUTPUT_FORMAT,
    )

    out_audio.write_bytes(base64.b64decode(result.audio_base_64))

    starts = result.alignment.character_start_times_seconds
    ends = result.alignment.character_end_times_seconds

    segments = []
    cursor = 0
    for line in script_lines:
        line_len = len(line)
        seg_start = starts[cursor]
        seg_end = ends[min(cursor + line_len - 1, len(ends) - 1)]
        segments.append({"text": line, "start": seg_start, "end": seg_end})
        cursor += line_len + 1  # +1 pour l'espace ajouté par join()

    return segments

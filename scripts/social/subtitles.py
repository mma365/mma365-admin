"""Construction d'un fichier .ass à partir des segments de timestamps ElevenLabs."""

from pathlib import Path

REEL_WIDTH, REEL_HEIGHT = 1080, 1920

ASS_HEADER = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {REEL_WIDTH}
PlayResY: {REEL_HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, Bold, Alignment, MarginV
Style: Default,Arial,64,&H00FFFFFF,&H00000000,1,2,220

[Events]
Format: Layer, Start, End, Style, Text
"""


def _sec_to_ass_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_subtitles(segments: list[dict], out_ass: Path) -> None:
    lines = [ASS_HEADER]
    for seg in segments:
        start = _sec_to_ass_time(seg["start"])
        end = _sec_to_ass_time(seg["end"])
        text = seg["text"].replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{start},{end},Default,{text}\n")

    out_ass.write_text("".join(lines), encoding="utf-8")

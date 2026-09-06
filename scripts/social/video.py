"""Assemblage du reel : Ken Burns (zoom/dézoom alterné) + voix off + sous-titres, via ffmpeg."""

import os
import subprocess
from pathlib import Path

from crop import prepare_image

REEL_WIDTH, REEL_HEIGHT = 1080, 1920
# Supersample 2x avant le crop pour que zoompan zoome sans pixeliser.
FRAME_CROP_SIZE = (REEL_WIDTH * 2, REEL_HEIGHT * 2)
FPS = 30


def build_reel(images: list[Path], audio_path: Path, ass_path: Path,
                out_video: Path, total_duration: float, work_dir: Path) -> None:
    work_dir = work_dir.resolve()
    frames_dir = work_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    cropped_images = []
    for i, img in enumerate(images):
        out_frame = frames_dir / f"frame_{i}.jpg"
        prepare_image(img, out_frame, *FRAME_CROP_SIZE)
        cropped_images.append(out_frame.resolve())

    n = len(cropped_images)
    per_image_duration = total_duration / n

    inputs = []
    filter_parts = []
    for i, img in enumerate(cropped_images):
        inputs += ["-loop", "1", "-t", str(per_image_duration), "-i", str(img)]
        zoom_dir = "in" if i % 2 == 0 else "out"
        zexpr = "zoom+0.0015" if zoom_dir == "in" else "if(eq(on,1),1.15,zoom-0.0015)"
        d_frames = max(1, int(per_image_duration * FPS))
        filter_parts.append(
            f"[{i}:v]zoompan=z='{zexpr}':d={d_frames}"
            f":s={REEL_WIDTH}x{REEL_HEIGHT}:fps={FPS},setsar=1[v{i}]"
        )

    concat_inputs = "".join(f"[v{i}]" for i in range(n))
    filter_parts.append(f"{concat_inputs}concat=n={n}:v=1:a=0[vconcat]")
    # ffmpeg (ce build) casse le parsing du filtre ass= dès qu'il y a un ':'
    # dans le chemin (lecteur Windows) -- ni les quotes ni le backslash
    # n'y changent rien. Seul un chemin relatif marche : on lance ffmpeg
    # avec cwd=work_dir et on passe juste le nom de fichier relatif.
    ass_relative = os.path.relpath(ass_path.resolve(), work_dir)
    filter_parts.append(f"[vconcat]ass={ass_relative}[vout]")

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-i", str(audio_path.resolve()),
        "-filter_complex", filter_complex,
        "-map", "[vout]", "-map", f"{n}:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        str(out_video.resolve()),
    ]
    subprocess.run(cmd, check=True, cwd=work_dir)

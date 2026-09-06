"""Image de post Instagram (1080x1350) : photo recadrée + titre en overlay, via Pillow."""

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from crop import CROP_STRATEGY

POST_SIZE = (1080, 1350)

# Police en dur pour Windows par défaut ; surchargeable via FONT_PATH_BOLD si
# le poste n'a pas Arial (ex: CI Linux) ou pour utiliser une police de marque.
DEFAULT_FONT_PATH = r"C:\Windows\Fonts\arialbd.ttf"


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    font_path = os.environ.get("FONT_PATH_BOLD", DEFAULT_FONT_PATH)
    try:
        return ImageFont.truetype(font_path, size)
    except OSError:
        return ImageFont.load_default(size=size)


def _wrap_title(draw: ImageDraw.ImageDraw, title: str, font: ImageFont.FreeTypeFont,
                 max_width: int) -> list[str]:
    """Découpe le titre en lignes qui tiennent dans max_width (mot par mot)."""
    words = title.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def build_post_image(background_photo: Path, title: str, out_image: Path,
                      size: tuple[int, int] = POST_SIZE) -> None:
    src = Image.open(background_photo).convert("RGB")
    img = CROP_STRATEGY(src, *size)

    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    margin = 50
    max_text_width = size[0] - 2 * margin
    font_size = 56
    font = _load_font(font_size)
    lines = _wrap_title(draw, title, font, max_text_width)

    # Si ça dépasse toujours 3 lignes (titre trop long malgré la limite de mots
    # imposée au skill), on réduit la police plutôt que de couper le texte.
    while len(lines) > 3 and font_size > 32:
        font_size -= 4
        font = _load_font(font_size)
        lines = _wrap_title(draw, title, font, max_text_width)

    line_height = int(font_size * 1.3)
    band_height = 160 + line_height * len(lines)
    draw.rectangle(
        [(0, size[1] - band_height), (size[0], size[1])],
        fill=(0, 0, 0, 160),
    )

    text_y = size[1] - band_height + 40
    for line in lines:
        draw.text((margin, text_y), line, font=font, fill="white")
        text_y += line_height

    combined = Image.alpha_composite(img.convert("RGBA"), overlay)
    combined.convert("RGB").save(out_image, quality=95)

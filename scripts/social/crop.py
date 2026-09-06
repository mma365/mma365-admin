"""Recadrage des images fournies vers un ratio cible.

CROP_STRATEGY est le seul point d'entrée utilisé par le reste du pipeline
(video.py, post_image.py). Pour brancher une détection de visage plus tard,
écrire une nouvelle fonction avec la même signature (Image, int, int) -> Image
et réassigner CROP_STRATEGY à la fin de ce fichier -- aucun autre fichier
n'a besoin d'être modifié.
"""

from PIL import Image


def center_crop_cover(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Crop centré façon object-fit: cover, puis resize exact vers la cible."""
    src_w, src_h = img.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        new_w = round(src_h * target_ratio)
        left = (src_w - new_w) // 2
        box = (left, 0, left + new_w, src_h)
    else:
        new_h = round(src_w / target_ratio)
        top = (src_h - new_h) // 2
        box = (0, top, src_w, top + new_h)

    return img.crop(box).resize((target_w, target_h), Image.LANCZOS)


CROP_STRATEGY = center_crop_cover


def prepare_image(src_path, out_path, target_w: int, target_h: int) -> None:
    """Charge src_path, applique CROP_STRATEGY vers (target_w, target_h), écrit out_path."""
    img = Image.open(src_path).convert("RGB")
    cropped = CROP_STRATEGY(img, target_w, target_h)
    cropped.save(out_path, quality=95)

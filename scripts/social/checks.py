"""Vérifications de prérequis, avec messages clairs plutôt qu'une stack trace ffmpeg/API."""

import os
import shutil


class PrereqError(RuntimeError):
    pass


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise PrereqError(
            "ffmpeg introuvable dans le PATH. Installe-le (ex: winget install Gyan.FFmpeg) "
            "et relance."
        )


def check_env(var_name: str) -> str:
    value = os.environ.get(var_name)
    if not value:
        raise PrereqError(
            f"{var_name} manquant. Ajoute-le dans mma365-admin/.env.local et relance."
        )
    return value

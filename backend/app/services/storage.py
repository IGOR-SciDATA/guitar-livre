import json
import os
from pathlib import Path


# Em produção, defina STORAGE_ROOT=/data/storage ao usar um disco persistente.
# Localmente, continua usando backend/storage.
_default_root = Path(__file__).resolve().parents[2] / "storage"
STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", str(_default_root))).resolve()
SONGS_ROOT = STORAGE_ROOT / "songs"


def create_song_storage(song_id: str, metadata: dict) -> str:
    song_directory = SONGS_ROOT / song_id
    song_directory.mkdir(parents=True, exist_ok=True)

    metadata_file = song_directory / "metadata.json"
    with metadata_file.open("w", encoding="utf-8") as file:
        json.dump(metadata, file, ensure_ascii=False, indent=4)

    return str(song_directory)

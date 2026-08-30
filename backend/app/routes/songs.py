from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from pathlib import Path
import json

from app.services.youtube import get_video_metadata
from app.services.storage import create_song_storage, SONGS_ROOT
from app.services.processor import process_song


router = APIRouter(prefix="/api/songs", tags=["songs"])

# Caminho base onde as músicas são armazenadas
STORAGE_SONGS_DIR = SONGS_ROOT


class YouTubeRequest(BaseModel):
    url: str


def get_song_difficulties(song_dir: Path) -> list[str]:
    """
    Retorna todas as dificuldades que já possuem chart JSON.
    """

    difficulties = []

    for diff in ["easy", "medium", "hard", "expert"]:
        if (song_dir / f"chart_{diff}.json").exists():
            difficulties.append(diff)

    return difficulties


def is_song_ready(song_dir: Path, metadata: dict) -> bool:
    """
    Uma música só é considerada pronta quando:

        1. metadata.status == "completed"
        2. video.mp4 existe
        3. master.ogg existe
        4. existe pelo menos uma chart

    Isso evita que a existência antecipada de chart_*.json
    faça o frontend anunciar a música antes do fim do processor.
    """

    status = metadata.get("status", "processing")

    if status != "completed":
        return False

    video_exists = (
        song_dir / "video.mp4"
    ).exists()

    master_exists = (
        song_dir / "master.ogg"
    ).exists()

    difficulties = get_song_difficulties(
        song_dir
    )

    has_chart = len(difficulties) > 0

    return (
        video_exists
        and master_exists
        and has_chart
    )


@router.get("")
def list_songs():
    """
    Lista todas as músicas salvas no storage.
    """

    songs = []

    if not STORAGE_SONGS_DIR.exists():
        return songs

    for song_dir in STORAGE_SONGS_DIR.iterdir():

        if not song_dir.is_dir():
            continue

        metadata_path = (
            song_dir / "metadata.json"
        )

        if not metadata_path.exists():
            continue

        try:

            with open(
                metadata_path,
                "r",
                encoding="utf-8"
            ) as f:

                metadata = json.load(f)

        except (
            json.JSONDecodeError,
            OSError
        ):

            # Ignora pastas com metadata corrompida.
            continue

        difficulties = get_song_difficulties(
            song_dir
        )

        ready = is_song_ready(
            song_dir,
            metadata
        )

        status = metadata.get(
            "status",
            "processing"
        )

        # ==========================================================
        # STATUS EXPOSTO AO FRONTEND
        # ==========================================================

        if ready:
            exposed_status = "completed"

        elif status == "error":
            exposed_status = "error"

        elif status == "processing":
            exposed_status = "processing"

        else:
            exposed_status = status

        song_data = {
            "id": metadata.get(
                "id"
            ) or song_dir.name,

            "title": metadata.get(
                "title",
                "Sem título"
            ),

            "artist": metadata.get(
                "artist",
                "Desconhecido"
            ),

            "thumbnail": metadata.get(
                "thumbnail",
                ""
            ),

            "duration": metadata.get(
                "duration",
                0
            ),

            "status": exposed_status,

            "ready": ready,

            "difficulties": difficulties,
        }

        songs.append(
            song_data
        )

    # Ordena por artista e título.
    songs.sort(
        key=lambda x: (
            x["artist"].lower(),
            x["title"].lower()
        )
    )

    return songs


@router.post("/metadata")
def metadata(
    request: YouTubeRequest
):
    try:

        return get_video_metadata(
            request.url
        )

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=(
                "Não foi possível obter os "
                f"dados do vídeo: {error}"
            ),
        )


@router.post("/confirm")
def confirm_song(
    request: YouTubeRequest,
    background_tasks: BackgroundTasks,
):
    try:

        metadata = get_video_metadata(
            request.url
        )

        song_id = (
            metadata["source_url"]
            .split("v=")[-1]
        )

        metadata["id"] = song_id

        # O processor ainda não começou/concluiu.
        metadata["status"] = "processing"

        song_directory = create_song_storage(
            song_id,
            metadata,
        )

        background_tasks.add_task(
            process_song,
            metadata["source_url"],
            song_directory,
        )

        return {
            "id": song_id,
            "status": "processing",
            "metadata": metadata,
        }

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=(
                "Não foi possível adicionar "
                f"a música: {error}"
            ),
        )
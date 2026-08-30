import os
import subprocess
from pathlib import Path


AUDIO_EXTENSIONS = {
    ".ogg",
    ".opus",
    ".mp3",
    ".m4a",
    ".wav",
}


def create_master_from_source_audio(
    source_audio_path: str,
    song_folder: str,
) -> str:
    """Converte o áudio temporário do YouTube em master.ogg para o fallback.

    Quando não existe chart do Enchor, não há stems para mixar. O gameplay ainda
    precisa de master.ogg, então usamos a própria fonte extraída do vídeo.
    """
    master_path = os.path.join(song_folder, "master.ogg")
    command = [
        "ffmpeg",
        "-y",
        "-i",
        source_audio_path,
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "libvorbis",
        "-q:a",
        "6",
        master_path,
    ]

    subprocess.run(command, check=True)

    if not os.path.exists(master_path):
        raise FileNotFoundError("FFmpeg terminou, mas master.ogg não foi criado.")

    print(f"[AudioMasterizer] Master do áudio-fonte criado: {master_path}")
    return master_path


def find_audio_stems(song_folder: str) -> list[str]:
    """
    Encontra as stems da chart dentro da pasta da música.

    Ignora:
        - audio.wav → áudio temporário extraído do YouTube
        - master.ogg → master já criado

    Aceita:
        .ogg
        .opus
        .mp3
        .m4a
        .wav
    """

    folder = Path(song_folder)

    if not folder.exists():
        raise FileNotFoundError(
            f"Pasta da música não encontrada: {song_folder}"
        )

    stems = []

    ignored_files = {
        "audio.wav",
        "master.ogg",
    }

    for path in folder.iterdir():

        if not path.is_file():
            continue

        filename = path.name.lower()

        if filename in ignored_files:
            continue

        if path.suffix.lower() not in AUDIO_EXTENSIONS:
            continue

        stems.append(path)

    stems.sort(
        key=lambda path: path.name.lower()
    )

    return [str(path) for path in stems]


def cleanup_source_audio(song_folder: str) -> None:
    """
    Remove as stems originais usadas na masterização.

    Mantém:
        - master.ogg
        - chart_*.json
        - video.mp4
        - audio.wav (será removido depois pelo processor)
        - metadata.json

    Remove:
        - song.opus
        - rhythm.opus
        - vocals.opus
        - guitar.opus
        - drums_*.opus
        - demais stems .ogg/.opus/.mp3/.m4a/.wav
        - song.ini
    """

    folder = Path(song_folder)

    if not folder.exists():
        return

    protected_files = {
        "master.ogg",
        "video.mp4",
        "audio.wav",
        "metadata.json",
    }

    audio_extensions = {
        ".ogg",
        ".opus",
        ".mp3",
        ".m4a",
        ".wav",
    }

    removed = []

    for path in folder.iterdir():

        if not path.is_file():
            continue

        filename = path.name.lower()

        # Nunca apagar arquivos protegidos.
        if filename in protected_files:
            continue

        # Remover qualquer stem de áudio.
        if path.suffix.lower() in audio_extensions:

            try:
                path.unlink()

                removed.append(
                    path.name
                )

            except Exception as e:

                print(
                    "[AudioMasterizer] "
                    f"Não foi possível remover "
                    f"{path.name}: {e}"
                )

    # O song.ini veio da chart e já não é necessário
    # depois que as dificuldades foram convertidas.
    song_ini = folder / "song.ini"

    if song_ini.exists():

        try:
            song_ini.unlink()

            removed.append(
                "song.ini"
            )

        except Exception as e:

            print(
                "[AudioMasterizer] "
                f"Não foi possível remover "
                f"song.ini: {e}"
            )

    print(
        "[AudioMasterizer] "
        f"Arquivos originais removidos: {len(removed)}"
    )

    for filename in removed:

        print(
            f"[AudioMasterizer] - {filename}"
        )

def build_master_audio(song_folder: str) -> str:
    """
    Junta todas as stems de áudio da chart em um único master.ogg.

    Exemplo:

        song.opus
        rhythm.opus
        guitar.opus
        vocals.opus
        drums_1.opus
        drums_2.opus

    vira:

        master.ogg

    Todas as stems são mantidas alinhadas pelo próprio FFmpeg,
    já que os arquivos da chart compartilham o mesmo timeline.
    """

    master_path = os.path.join(
        song_folder,
        "master.ogg"
    )

    stems = find_audio_stems(
        song_folder
    )

    if not stems:
        raise FileNotFoundError(
            "Nenhum arquivo de áudio foi encontrado "
            "para criar o master."
        )

    print(
        "[AudioMasterizer] "
        f"{len(stems)} stems encontradas."
    )

    for stem in stems:
        print(
            "[AudioMasterizer] + "
            f"{os.path.basename(stem)}"
        )

    # Remove master anterior.
    if os.path.exists(master_path):
        os.remove(master_path)

    # ==========================================================
    # INPUTS
    # ==========================================================

    command = [
        "ffmpeg",
        "-y",
    ]

    for stem in stems:
        command.extend([
            "-i",
            stem
        ])

    # ==========================================================
    # MIXAGEM
    # ==========================================================
    #
    # [0:a][1:a][2:a]...
    #
    #     ↓
    #
    # amix
    #
    #     ↓
    #
    # limiter
    #
    #     ↓
    #
    # [master]
    # ==========================================================

    input_labels = "".join(
        f"[{index}:a]"
        for index in range(len(stems))
    )

    filter_complex = (
        f"{input_labels}"
        f"amix="
        f"inputs={len(stems)}:"
        f"duration=longest:"
        f"dropout_transition=0:"
        f"normalize=1,"
        f"alimiter="
        f"limit=0.95:"
        f"attack=5:"
        f"release=50"
        f"[master]"
    )

    command.extend([
        "-filter_complex",
        filter_complex,

        "-map",
        "[master]",

        # Formato final padronizado
        "-ar",
        "48000",

        "-ac",
        "2",

        # OGG Vorbis
        "-c:a",
        "libvorbis",

        "-q:a",
        "6",

        master_path,
    ])

    print(
        "[AudioMasterizer] "
        "Iniciando masterização..."
    )

    try:

        subprocess.run(
            command,
            check=True
        )

    except subprocess.CalledProcessError as e:

        raise RuntimeError(
            "FFmpeg falhou durante a masterização."
        ) from e

    if not os.path.exists(master_path):

        raise FileNotFoundError(
            "FFmpeg terminou, mas master.ogg "
            "não foi criado."
        )

    size_mb = (
        os.path.getsize(master_path)
        / (1024 * 1024)
    )

    print(
        "[AudioMasterizer] "
        f"Master criado: {master_path}"
    )

    print(
        "[AudioMasterizer] "
        f"Tamanho: {size_mb:.2f} MB"
    )

    return master_path

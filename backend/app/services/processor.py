import os
import glob
import subprocess
import json
import re
import yt_dlp

from app.services.audio_composer import compose_charts
from app.services.enchor_client import download_chart_from_enchor
from app.services.enchor_extractor import extract_enchor_zip
from app.services.audio_masterizer import (
    build_master_audio,
    cleanup_source_audio,
    create_master_from_source_audio,
)


def extract_song_info(title: str, uploader: str = "") -> tuple:
    """
    Extrai nome da música e artista do título do YouTube.
    Retorna (song_name, artist_name)
    """
    # Remove sufixos comuns
    clean_title = title
    # Remove parênteses/colchetes no final e tags comuns
    clean_title = re.sub(r'\s*[\(\[][^\)\]]*[\)\]]\s*$', '', clean_title)
    clean_title = re.sub(r'\s*[-–]\s*(HD|4K|Official|Music Video|Live|Remastered|Lyrics|Audio|Cover|Tribute|Instrumental|Karaoke|Topic|VEVO)\s*$', '', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'\s*\([^)]*\)\s*', ' ', clean_title)  # remove parênteses internos
    clean_title = re.sub(r'\s*\[[^\]]*\]\s*', ' ', clean_title)  # remove colchetes internos
    clean_title = re.sub(r'\s+', ' ', clean_title).strip()

    # Tenta separar por " - " primeiro
    separators = [' - ', ' – ', '—']
    artist_name = uploader
    song_name = clean_title

    for sep in separators:
        if sep in clean_title:
            parts = clean_title.split(sep, 1)
            potential_artist = parts[0].strip()
            potential_song = parts[1].strip()
            # Valida: ambos com pelo menos 2 caracteres
            if len(potential_artist) >= 2 and len(potential_song) >= 2:
                artist_name = potential_artist
                song_name = potential_song
                break

    # Se ainda estiver usando o uploader, tenta limpar o uploader
    if artist_name == uploader:
        # Remove palavras comuns de canais
        artist_name = re.sub(r'\s*(Topic|VEVO|Official|Channel|Music|Records|Label|Entertainment|Studio)\s*$', '', artist_name, flags=re.IGNORECASE)
        artist_name = artist_name.strip()
        if not artist_name:
            artist_name = "Unknown Artist"

    # Remove sufixos residuais do nome da música
    song_name = re.sub(r'\s*(Official Music Video|Official Video|Music Video|HD|4K|Live|Remastered|Lyrics|Audio|Cover|Tribute|Instrumental|Karaoke|Topic|VEVO)\s*$', '', song_name, flags=re.IGNORECASE)
    song_name = song_name.strip()

    # Se o nome da música ainda estiver muito longo, tenta extrair a primeira parte
    if len(song_name) > 60:
        match = re.match(r'^([^\(\[\-]+)', song_name)
        if match:
            song_name = match.group(1).strip()

    return song_name, artist_name


def process_song(youtube_url: str, song_folder: str):
    print("[Guitar Livre] =======================================")
    print("[Guitar Livre] INICIANDO PROCESSAMENTO")
    print("[Guitar Livre] =======================================")

    os.makedirs(song_folder, exist_ok=True)

    video_path = os.path.join(song_folder, "video.mp4")
    audio_path = os.path.join(song_folder, "audio.wav")

    output_template = os.path.join(song_folder, "%(title)s.%(ext)s")

    # ============================================================
    # CONFIGURAÇÃO DO YT-DLP
    # ============================================================
    ydl_opts = {
        "format": (
            "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/"
            "bestvideo[height<=480]+bestaudio/ "
            "best[height<=480][ext=mp4]/"
            "best[height<=480]/best"
        ),
        "merge_output_format": "mp4",
        "outtmpl": output_template,
        "noplaylist": True,
        "force_ipv4": True,
        "extractor_args": {
            "youtube": {}
        },
        "remote_components": ["ejs:github"],
        "js_runtimes": {"deno": {}},
        "nocheckcertificate": True,
        "quiet": False,
        "no_warnings": False,
        "retries": 5,
        "fragment_retries": 5,
        "continuedl": True,
        "overwrites": True,
        "concurrent_fragment_downloads": 1,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/151.0.0.0 Safari/537.36"
            )
        },
    }

    try:
        # ========================================================
        # 1. DOWNLOAD
        # ========================================================
        print("[Guitar Livre] Etapa 1/7")
        print("[Guitar Livre] Baixando vídeo em 480p...")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)

        print("[Guitar Livre] Download concluído!")

        # ========================================================
        # 2. LOCALIZAR MP4
        # ========================================================
        print("[Guitar Livre] Etapa 2/7")
        print("[Guitar Livre] Localizando vídeo baixado...")

        mp4_files = glob.glob(os.path.join(song_folder, "*.mp4"))
        mp4_files = [
            path for path in mp4_files
            if os.path.abspath(path) != os.path.abspath(video_path)
        ]

        if not mp4_files:
            if os.path.exists(video_path):
                print("[Guitar Livre] video.mp4 já existe.")
            else:
                raise FileNotFoundError("Nenhum arquivo MP4 foi encontrado após o download.")
        else:
            downloaded_video = mp4_files[0]
            print(f"[Guitar Livre] Vídeo encontrado: {downloaded_video}")

            if os.path.exists(video_path):
                os.remove(video_path)
            os.rename(downloaded_video, video_path)

        print(f"[Guitar Livre] Vídeo final: {video_path}")

        # ========================================================
        # 3. VERIFICAR TAMANHO MÁXIMO
        # ========================================================
        print("[Guitar Livre] Etapa 3/7")
        print("[Guitar Livre] Verificando tamanho do vídeo...")

        MAX_VIDEO_SIZE_MB = 30
        video_size_mb = os.path.getsize(video_path) / (1024 * 1024)
        print(f"[Guitar Livre] Tamanho: {video_size_mb:.1f} MB")

        if video_size_mb > MAX_VIDEO_SIZE_MB:
            os.remove(video_path)
            raise ValueError(
                f"O vídeo baixado excede o limite de {MAX_VIDEO_SIZE_MB} MB "
                f"({video_size_mb:.1f} MB). Por favor, escolha um vídeo menor."
            )

        # ========================================================
        # 4. EXTRAIR ÁUDIO
        # ========================================================
        print("[Guitar Livre] Etapa 4/7")
        print("[Guitar Livre] Extraindo áudio...")

        ffmpeg_command = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "44100",
            "-ac", "2",
            audio_path,
        ]
        subprocess.run(ffmpeg_command, check=True)

        if not os.path.exists(audio_path):
            raise FileNotFoundError("O FFmpeg terminou, mas o audio.wav não foi criado.")

        print(f"[Guitar Livre] Áudio extraído: {audio_path}")

        # ========================================================
        # 5. TENTAR BAIXAR CHART DO ENCHOR (APENAS UMA VEZ)
        # ========================================================
        print("[Guitar Livre] Etapa 5/7 - Buscando chart no Enchor...")

        raw_title = info.get('title', '')
        uploader = info.get('uploader', '')
        song_title, song_artist = extract_song_info(raw_title, uploader)

        print(f"[Guitar Livre] Título original: {raw_title}")
        print(f"[Guitar Livre] Música extraída: {song_title}")
        print(f"[Guitar Livre] Artista extraído: {song_artist}")

        # Baixa apenas uma vez (usando expert, mas o zip contém todas as dificuldades)
        zip_path = download_chart_from_enchor(
            song_name=song_title,
            artist_name=song_artist,
            difficulty="expert",
            download_dir=song_folder,
            headless=True
        )

        downloaded_diffs = []
        failed_diffs = []
        chart_converted = False
        master_audio_path = None

        if zip_path and os.path.exists(zip_path):

            print(
                f"[Guitar Livre] "
                f"Chart baixado: {zip_path}"
            )

            downloaded_diffs = extract_enchor_zip(
                zip_path,
                song_folder
            )

            if downloaded_diffs:

                chart_converted = True

                print(
                    "[Guitar Livre] "
                    "Charts extraídos com sucesso."
                )

                # ==================================================
                # NOVO:
                # MASTERIZAR TODAS AS STEMS
                # ==================================================

                try:

                    print(
                        "[Guitar Livre] "
                        "Iniciando masterização..."
                    )

                    master_audio_path = build_master_audio(
                        song_folder
                    )

                    # ==========================================================
                    # LIMPAR ARQUIVOS ORIGINAIS DA CHART
                    # ==========================================================

                    cleanup_source_audio(
                        song_folder
                    )
                                        
                    print(
                        "[Guitar Livre] "
                        f"Master pronto: "
                        f"{master_audio_path}"
                    )

                except Exception as e:

                    print(
                        "[Guitar Livre] "
                        "Erro na masterização:"
                    )

                    print(
                        f"[Guitar Livre] {e}"
                    )

                    # A chart continua válida.
                    # Não vamos derrubar o processamento inteiro.
                    master_audio_path = None

                os.remove(
                    zip_path
                )

                print(
                    "[Guitar Livre] "
                    f"Charts extraídos: "
                    f"{', '.join(downloaded_diffs)}"
                )

            else:

                print(
                    "[Guitar Livre] "
                    "Falha ao extrair charts."
                )

                failed_diffs = [
                    "easy",
                    "medium",
                    "hard",
                    "expert",
                ]

        else:

            print(
                "[Guitar Livre] "
                "Nenhum chart encontrado no Enchor."
            )

            failed_diffs = [
                "easy",
                "medium",
                "hard",
                "expert",
            ]

        # ========================================================
        # 6. FALLBACK DETERMINÍSTICO POR ÁUDIO
        # ========================================================
        if not chart_converted:
            print("[Guitar Livre] Nenhuma chart do Enchor encontrada.")
            print("[Guitar Livre] Compondo chart determinística pelo áudio...")
            compose_charts(audio_path, song_folder)
            master_audio_path = create_master_from_source_audio(
                audio_path,
                song_folder,
            )

        # ========================================================
        # 7. REMOVER ÁUDIO TEMPORÁRIO
        # ========================================================
        print("[Guitar Livre] Etapa 7/7")
        print("[Guitar Livre] Removendo áudio temporário...")
        
        if os.path.exists(audio_path):
            os.remove(audio_path)
        print("[Guitar Livre] Áudio temporário removido.")

        # Atualiza metadata
        metadata_path = os.path.join(song_folder, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                metadata["status"] = "completed"
                metadata["source"] = "enchor" if chart_converted else "audio_composed"
                if downloaded_diffs:
                    metadata["downloaded_difficulties"] = downloaded_diffs
                metadata["title"] = song_title
                metadata["artist"] = song_artist
                with open(metadata_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f, ensure_ascii=False, indent=4)
            except Exception as e:
                print(f"[Guitar Livre] Erro ao atualizar metadata: {e}")

        # ========================================================
        # FINAL
        # ========================================================
        print("[Guitar Livre] =======================================")
        print("[Guitar Livre] PROCESSAMENTO CONCLUÍDO")
        print("[Guitar Livre] =======================================")

        return {
            "status": "completed",
            "info": info,
            "source": "enchor" if chart_converted else "audio_composed",
            "downloaded_difficulties": downloaded_diffs,
            "song_title": song_title,
            "song_artist": song_artist
        }

    except Exception as e:
        print("[Guitar Livre] =======================================")
        print("[Guitar Livre] ERRO NO PROCESSAMENTO")
        print(f"[Guitar Livre] {e}")
        print("[Guitar Livre] =======================================")
        
        metadata_path = os.path.join(song_folder, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                metadata["status"] = "error"
                metadata["error"] = str(e)
                with open(metadata_path, "w", encoding="utf-8") as f:
                    json.dump(metadata, f, ensure_ascii=False, indent=4)
            except:
                pass
        
        raise

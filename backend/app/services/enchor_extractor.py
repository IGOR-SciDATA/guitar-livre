import os
import json
import zipfile
import shutil
from pathlib import Path

def extract_enchor_zip(zip_path: str, song_folder: str) -> list:
    """
    Extrai um .zip baixado do Enchor (que contém todas as dificuldades),
    converte cada dificuldade para chart_{diff}.json e copia áudio e metadados.
    Retorna a lista de dificuldades extraídas com sucesso.
    """
    extracted_diffs = []
    temp_dir = Path(song_folder) / "temp_enchor"
    temp_dir.mkdir(exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        # Encontra chart
        chart_file = None
        chart_type = None
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.chart'):
                    chart_file = os.path.join(root, file)
                    chart_type = 'chart'
                    break
                elif file.endswith('.mid'):
                    chart_file = os.path.join(root, file)
                    chart_type = 'mid'
                    break
            if chart_file:
                break

        if not chart_file:
            print("[EnchorExtractor] Nenhum arquivo .chart/.mid encontrado.")
            return []

        # BPM do song.ini
        bpm = 120
        ini_file = None
        for root, dirs, files in os.walk(temp_dir):
            if 'song.ini' in files:
                ini_file = os.path.join(root, 'song.ini')
                break
        if ini_file:
            bpm = extract_bpm_from_ini(ini_file)
            dest_ini = os.path.join(song_folder, 'song.ini')
            shutil.copy(ini_file, dest_ini)
            print("[EnchorExtractor] song.ini copiado.")

        # ==========================================================
        # ÁUDIO
        # Copiar TODAS as stems da chart
        # ==========================================================

        audio_extensions = {
            ".ogg",
            ".opus",
            ".mp3",
            ".m4a",
            ".wav",
        }

        copied_audio = []

        print(
            "[EnchorExtractor] "
            "Procurando stems de áudio..."
        )

        for root, dirs, files in os.walk(temp_dir):

            for file in files:

                source = Path(root) / file

                if source.suffix.lower() not in audio_extensions:
                    continue

                # Não copiar master antigo.
                if source.name.lower() == "master.ogg":
                    continue

                destination = (
                    Path(song_folder)
                    / source.name
                )

                # Evita colisões de nomes.
                if destination.exists():

                    stem = destination.stem
                    suffix = destination.suffix

                    counter = 1

                    while destination.exists():

                        destination = (
                            Path(song_folder)
                            / f"{stem}_{counter}{suffix}"
                        )

                        counter += 1

                shutil.copy2(
                    source,
                    destination
                )

                copied_audio.append(
                    str(destination)
                )

                print(
                    "[EnchorExtractor] "
                    f"Áudio copiado: "
                    f"{source.name} -> "
                    f"{destination.name}"
                )

        print(
            "[EnchorExtractor] "
            f"{len(copied_audio)} stems copiadas."
        )

        # Extrai cada dificuldade
        difficulties = ["easy", "medium", "hard", "expert"]
        for diff in difficulties:
            try:
                if chart_type == 'chart':
                    # Importação local para evitar circular
                    from app.services.model_pipeline.parse_chart import parse_chart_difficulty
                    notes = parse_chart_difficulty(chart_file, diff)
                else:
                    from app.services.model_pipeline.parse_midi import parse_midi_difficulty
                    notes = parse_midi_difficulty(chart_file, diff)

                if not notes:
                    print(f"[EnchorExtractor] Nenhuma nota para {diff}, pulando.")
                    continue

                chart_json_path = os.path.join(song_folder, f"chart_{diff}.json")
                with open(chart_json_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "version": 2,
                        "difficulty": diff,
                        "bpm": bpm,
                        "duration": 0,
                        "lanes": 5,
                        "notes": notes
                    }, f, indent=4, ensure_ascii=False)
                extracted_diffs.append(diff)
                print(f"[EnchorExtractor] Chart {diff} salvo.")

            except Exception as e:
                print(f"[EnchorExtractor] Erro ao extrair {diff}: {e}")

        shutil.rmtree(temp_dir)
        return extracted_diffs

    except Exception as e:
        print(f"[EnchorExtractor] Erro geral: {e}")
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        return []


def extract_bpm_from_ini(ini_path):
    try:
        with open(ini_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.lower().startswith('bpm'):
                    parts = line.split('=')
                    if len(parts) == 2:
                        return float(parts[1].strip())
    except:
        pass
    return 120
import re
from pathlib import Path

LANES = 5

# ---------------------------------------------------------------------------
# Mapeamento das dificuldades do formato .chart
# ---------------------------------------------------------------------------

DIFFICULTY_SECTIONS = {
    "easy": "EasySingle",
    "medium": "MediumSingle",
    "hard": "HardSingle",
    "expert": "ExpertSingle",
}


# ---------------------------------------------------------------------------
# SONG / RESOLUTION
# ---------------------------------------------------------------------------

def parse_resolution(content: str) -> int:
    """
    Extrai a resolução PPQN do bloco [Song].

    Exemplo:

    [Song]
    {
        Resolution = 192
        ...
    }

    Caso não encontre, usa 192 para manter compatibilidade
    com charts antigas.
    """

    patterns = [
        r"\[Song\]\s*\{\s*(.*?)\s*\}",
        r"\[Song\]\n(.*?)(?:\n\n|\Z)",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            content,
            re.DOTALL | re.IGNORECASE,
        )

        if not match:
            continue

        section = match.group(1)

        resolution_match = re.search(
            r"^\s*Resolution\s*=\s*(\d+)",
            section,
            re.MULTILINE | re.IGNORECASE,
        )

        if resolution_match:

            try:
                resolution = int(
                    resolution_match.group(1)
                )

                if resolution > 0:
                    return resolution

            except ValueError:
                pass

    print(
        "[ChartParser] Resolution não encontrada. "
        "Usando 192 como fallback."
    )

    return 192


# ---------------------------------------------------------------------------
# SYNC TRACK
# ---------------------------------------------------------------------------

def parse_sync_track(content: str) -> list[tuple[int, float]]:
    """
    Extrai os eventos de BPM do [SyncTrack].

    Retorna:

        [
            (tick, bpm),
            ...
        ]

    Exemplo:

        [
            (0, 120.0),
            (1920, 140.0),
        ]
    """

    match = re.search(
        r"\[SyncTrack\]\s*\{\s*(.*?)\s*\}",
        content,
        re.DOTALL | re.IGNORECASE,
    )

    # Algumas charts podem vir sem chaves.
    if not match:

        match = re.search(
            r"\[SyncTrack\]\s*(.*?)(?:\n\n|\Z)",
            content,
            re.DOTALL | re.IGNORECASE,
        )

    if not match:

        print(
            "[ChartParser] SyncTrack não encontrada. "
            "Usando BPM 120."
        )

        return [(0, 120.0)]

    lines = match.group(1).strip().splitlines()

    sync_events = []

    for line in lines:

        line = line.strip()

        if not line:
            continue

        parts = line.split("=", 1)

        if len(parts) != 2:
            continue

        tick_str = parts[0].strip()
        event_data = parts[1].strip()

        if not event_data.startswith("B "):
            continue

        try:

            tick = int(tick_str)

            bpm_raw = event_data.split()[1]

            bpm = int(bpm_raw) / 1000.0

            if bpm <= 0:
                continue

            sync_events.append(
                (
                    tick,
                    bpm,
                )
            )

        except (
            ValueError,
            IndexError,
        ):
            continue

    sync_events.sort(
        key=lambda item: item[0]
    )

    if not sync_events:

        sync_events = [
            (
                0,
                120.0,
            )
        ]

    # Garante que exista uma referência de BPM no tick 0.
    if sync_events[0][0] != 0:

        sync_events.insert(
            0,
            (
                0,
                sync_events[0][1],
            )
        )

    return sync_events


# ---------------------------------------------------------------------------
# TICK -> SEGUNDOS
# ---------------------------------------------------------------------------

def build_timing_segments(
    sync_events: list[tuple[int, float]],
    resolution: int,
):
    """
    Pré-calcula segmentos temporais para evitar recalcular todo o SyncTrack
    para cada nota.

    Cada segmento contém:

        {
            "start_tick": ...,
            "end_tick": ...,
            "start_seconds": ...,
            "bpm": ...
        }
    """

    if not sync_events:
        sync_events = [
            (
                0,
                120.0,
            )
        ]

    segments = []

    elapsed_seconds = 0.0

    for index, (
        tick,
        bpm,
    ) in enumerate(sync_events):

        if index == 0:

            start_tick = tick

        else:

            previous_tick = (
                sync_events[index - 1][0]
            )

            previous_bpm = (
                sync_events[index - 1][1]
            )

            delta_ticks = (
                tick - previous_tick
            )

            elapsed_seconds += (
                delta_ticks
                / resolution
                * (60.0 / previous_bpm)
            )

            start_tick = tick

        if index + 1 < len(sync_events):

            end_tick = (
                sync_events[index + 1][0]
            )

        else:

            end_tick = None

        segments.append(
            {
                "start_tick": start_tick,
                "end_tick": end_tick,
                "start_seconds": elapsed_seconds,
                "bpm": bpm,
            }
        )

    return segments


def ticks_to_seconds(
    ticks: int,
    sync_events: list[tuple[int, float]],
    resolution: int = 192,
    timing_segments=None,
) -> float:
    """
    Converte ticks para segundos respeitando todas as mudanças de BPM.

    Usa timing_segments pré-calculados quando fornecidos.
    """

    if ticks <= 0:
        return 0.0

    if not timing_segments:

        timing_segments = build_timing_segments(
            sync_events,
            resolution,
        )

    current_segment = timing_segments[0]

    for segment in timing_segments:

        start_tick = segment["start_tick"]
        end_tick = segment["end_tick"]

        if (
            ticks >= start_tick
            and (
                end_tick is None
                or ticks < end_tick
            )
        ):
            current_segment = segment
            break

    delta_ticks = (
        ticks
        - current_segment["start_tick"]
    )

    seconds = (
        current_segment["start_seconds"]
        + (
            delta_ticks
            / resolution
            * (60.0 / current_segment["bpm"])
        )
    )

    return seconds


# ---------------------------------------------------------------------------
# DIFFICULTY SECTION
# ---------------------------------------------------------------------------

def find_difficulty_section(
    content: str,
    difficulty: str,
):
    """
    Encontra a seção da dificuldade solicitada.

    Exemplo:

        [HardSingle]
        {
            ...
        }
    """

    section_name = DIFFICULTY_SECTIONS.get(
        difficulty.lower(),
        "ExpertSingle",
    )

    patterns = [

        # Formato com chaves.
        (
            rf"\[{re.escape(section_name)}\]"
            rf"\s*\{{\s*(.*?)\s*\}}"
        ),

        # Formato sem chaves.
        (
            rf"\[{re.escape(section_name)}\]"
            rf"\s*(.*?)(?:\n\n|\Z)"
        ),

    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            content,
            re.DOTALL | re.IGNORECASE,
        )

        if match:

            return (
                match
                .group(1)
                .strip()
                .splitlines()
            )

    return None


# ---------------------------------------------------------------------------
# PARSE DIFFICULTY
# ---------------------------------------------------------------------------

def parse_chart_difficulty(
    chart_path: str,
    difficulty: str = "expert",
):
    """
    Lê uma dificuldade de um arquivo .chart.

    Mantém:

        time
        lane
        duration

    Para lane 5 (OPEN):

        lane = 5
        type = "open"

    Para notas normais:

        type = "gem"
    """

    chart_path = Path(
        chart_path
    )

    if not chart_path.exists():
        raise FileNotFoundError(
            f"Chart não encontrada: {chart_path}"
        )

    with open(
        chart_path,
        "r",
        encoding="utf-8-sig",
    ) as file:

        content = file.read()

    # ------------------------------------------------------------
    # RESOLUTION
    # ------------------------------------------------------------

    resolution = parse_resolution(
        content
    )

    # ------------------------------------------------------------
    # SYNC TRACK
    # ------------------------------------------------------------

    sync_events = parse_sync_track(
        content
    )

    timing_segments = build_timing_segments(
        sync_events,
        resolution,
    )

    # ------------------------------------------------------------
    # DIFFICULTY
    # ------------------------------------------------------------

    notes_lines = find_difficulty_section(
        content,
        difficulty,
    )

    if not notes_lines:

        raise ValueError(
            f"Seção para dificuldade "
            f"'{difficulty}' não encontrada "
            f"no arquivo .chart"
        )

    notes = []

    # ------------------------------------------------------------
    # EVENTOS
    # ------------------------------------------------------------

    for line in notes_lines:

        line = line.strip()

        if not line:
            continue

        parts = line.split(
            "=",
            1,
        )

        if len(parts) != 2:
            continue

        tick_str = parts[0].strip()

        event_data = parts[1].strip()

        # Atualmente nos interessam eventos N.
        # Eventos S, E etc. ficam preservados no arquivo original
        # e serão tratados em uma etapa posterior.
        if not event_data.startswith("N "):
            continue

        try:

            event_parts = event_data.split()

            if len(event_parts) < 3:
                continue

            lane = int(
                event_parts[1]
            )

            sustain_ticks = int(
                event_parts[2]
            )

            tick = int(
                tick_str
            )

            # ----------------------------------------------------
            # LANE
            # ----------------------------------------------------

            if lane < 0:
                continue

            # Lane 5 é OPEN NOTE.
            if lane > 5:
                continue

            # ----------------------------------------------------
            # TEMPO DA CABEÇA
            # ----------------------------------------------------

            time_sec = ticks_to_seconds(
                tick,
                sync_events,
                resolution,
                timing_segments,
            )

            # ----------------------------------------------------
            # DURAÇÃO
            # ----------------------------------------------------

            if sustain_ticks > 0:

                end_time_sec = ticks_to_seconds(
                    tick + sustain_ticks,
                    sync_events,
                    resolution,
                    timing_segments,
                )

                duration_sec = (
                    end_time_sec
                    - time_sec
                )

            else:

                duration_sec = 0.0

            # Evita pequenos erros numéricos.
            if duration_sec < 0:
                duration_sec = 0.0

            # ----------------------------------------------------
            # TIPO
            # ----------------------------------------------------

            note_type = (
                "open"
                if lane == 5
                else "gem"
            )

            # ----------------------------------------------------
            # NOTA
            # ----------------------------------------------------

            notes.append(
                {
                    "time": round(
                        time_sec,
                        6,
                    ),

                    "lane": lane,

                    "duration": (
                        round(
                            duration_sec,
                            6,
                        )
                        if duration_sec > 0
                        else 0.0
                    ),

                    "type": note_type,
                }
            )

        except (
            ValueError,
            IndexError,
        ):
            continue

    # ------------------------------------------------------------
    # ORDENAR
    # ------------------------------------------------------------

    notes.sort(
        key=lambda note: (
            note["time"],
            note["lane"],
        )
    )

    return notes


# ---------------------------------------------------------------------------
# COMPATIBILIDADE
# ---------------------------------------------------------------------------

def parse_chart_file(
    chart_path: str,
):
    """
    Compatibilidade com o parser antigo.

    Lê ExpertSingle.
    """

    return parse_chart_difficulty(
        chart_path,
        "expert",
    )


# ---------------------------------------------------------------------------
# TESTE LOCAL
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    import argparse
    import json

    parser = argparse.ArgumentParser(
        description="Parser de arquivos .chart do Guitar Livre."
    )

    parser.add_argument(
        "chart",
        help="Caminho do arquivo .chart",
    )

    parser.add_argument(
        "--difficulty",
        default="expert",
        choices=[
            "easy",
            "medium",
            "hard",
            "expert",
        ],
    )

    parser.add_argument(
        "--output",
        default=None,
        help="Arquivo JSON de saída.",
    )

    args = parser.parse_args()

    result = parse_chart_difficulty(
        args.chart,
        args.difficulty,
    )

    print(
        f"[ChartParser] Chart: {args.chart}"
    )

    print(
        f"[ChartParser] Difficulty: "
        f"{args.difficulty}"
    )

    print(
        f"[ChartParser] Notas: "
        f"{len(result)}"
    )

    open_notes = sum(
        1
        for note in result
        if note["type"] == "open"
    )

    sustains = sum(
        1
        for note in result
        if note["duration"] > 0
    )

    print(
        f"[ChartParser] Open notes: "
        f"{open_notes}"
    )

    print(
        f"[ChartParser] Sustains: "
        f"{sustains}"
    )

    if args.output:

        with open(
            args.output,
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                result,
                file,
                ensure_ascii=False,
                indent=4,
            )

        print(
            f"[ChartParser] JSON salvo em: "
            f"{args.output}"
        )
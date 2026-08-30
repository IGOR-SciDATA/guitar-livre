import mido
from pathlib import Path


# ============================================================
# CONFIGURAÇÃO DAS NOTAS
# ============================================================

DIFFICULTY_NOTES = {
    "easy": {
        60: 0,  # Green
        61: 1,  # Red
        62: 2,  # Yellow
        63: 3,  # Blue
        64: 4,  # Orange
    },

    "medium": {
        72: 0,
        73: 1,
        74: 2,
        75: 3,
        76: 4,
    },

    "hard": {
        84: 0,
        85: 1,
        86: 2,
        87: 3,
        88: 4,
    },

    "expert": {
        96: 0,
        97: 1,
        98: 2,
        99: 3,
        100: 4,
    },
}


# ============================================================
# ENCONTRA A TRACK PART GUITAR
# ============================================================

def find_guitar_track(mid):
    """
    Procura exclusivamente pela track PART GUITAR.

    Não usamos fallback para a track com mais notas,
    porque isso pode selecionar bateria, baixo etc.
    """

    for track in mid.tracks:

        for msg in track:

            if msg.type == "track_name":

                track_name = msg.name.strip().upper()

                if track_name == "PART GUITAR":
                    return track

                break

    raise ValueError(
        "Track 'PART GUITAR' não encontrada no MIDI."
    )


# ============================================================
# CONSTRÓI O MAPA DE TEMPO
# ============================================================

def build_tempo_map(mid):
    """
    Cria um mapa de todos os eventos SET_TEMPO do MIDI.

    O MIDI trabalha em ticks.
    Cada mudança de tempo altera a relação:

        ticks -> segundos

    Retorna uma lista contendo:

        tick
        tempo
        tempo acumulado em segundos
    """

    tempo_events = []

    # Track que normalmente contém os eventos globais
    # pode variar dependendo do arquivo, então procuramos
    # em todas as tracks.
    for track in mid.tracks:

        absolute_tick = 0

        for msg in track:

            absolute_tick += msg.time

            if msg.type == "set_tempo":

                tempo_events.append(
                    (
                        absolute_tick,
                        msg.tempo
                    )
                )

    # Ordena por tick
    tempo_events.sort(key=lambda x: x[0])

    # Se não existir nenhum evento de tempo,
    # usamos 120 BPM como fallback.
    if not tempo_events:

        return [
            {
                "tick": 0,
                "tempo": 500000,
                "seconds": 0.0
            }
        ]

    # Remove eventos duplicados no mesmo tick,
    # mantendo o último.
    cleaned = []

    for tick, tempo in tempo_events:

        if cleaned and cleaned[-1][0] == tick:
            cleaned[-1] = (tick, tempo)
        else:
            cleaned.append((tick, tempo))

    tempo_map = []

    accumulated_seconds = 0.0

    previous_tick = cleaned[0][0]
    previous_tempo = cleaned[0][1]

    # Se o primeiro evento não estiver no tick 0,
    # assumimos que o primeiro tempo vale desde o início.
    if previous_tick != 0:

        tempo_map.append(
            {
                "tick": 0,
                "tempo": previous_tempo,
                "seconds": 0.0
            }
        )

        previous_tick = 0

    else:

        tempo_map.append(
            {
                "tick": 0,
                "tempo": previous_tempo,
                "seconds": 0.0
            }
        )

    # Processa mudanças seguintes
    for tick, tempo in cleaned:

        if tick == 0:
            continue

        delta_ticks = tick - previous_tick

        # ticks -> segundos
        delta_seconds = mido.tick2second(
            delta_ticks,
            mid.ticks_per_beat,
            previous_tempo
        )

        accumulated_seconds += delta_seconds

        tempo_map.append(
            {
                "tick": tick,
                "tempo": tempo,
                "seconds": accumulated_seconds
            }
        )

        previous_tick = tick
        previous_tempo = tempo

    return tempo_map


# ============================================================
# CONVERTE TICK -> SEGUNDOS
# ============================================================

def tick_to_seconds(tick, tempo_map, ticks_per_beat):
    """
    Converte um tick absoluto do MIDI para segundos,
    respeitando todas as mudanças de BPM.
    """

    # Começamos pelo primeiro segmento.
    current_segment = tempo_map[0]

    # Percorre o mapa até encontrar o segmento correto.
    for i in range(1, len(tempo_map)):

        if tick < tempo_map[i]["tick"]:
            break

        current_segment = tempo_map[i]

    delta_ticks = tick - current_segment["tick"]

    delta_seconds = mido.tick2second(
        delta_ticks,
        ticks_per_beat,
        current_segment["tempo"]
    )

    return current_segment["seconds"] + delta_seconds


# ============================================================
# PARSER PRINCIPAL
# ============================================================

def parse_midi_difficulty(
    midi_path,
    difficulty="expert"
):
    """
    Converte uma dificuldade do PART GUITAR
    para o formato utilizado pelo Guitar Livre.

    Retorna:

        [
            {
                "time": 10.617,
                "lane": 2,
                "duration": 0.166
            }
        ]
    """

    difficulty = difficulty.lower()

    if difficulty not in DIFFICULTY_NOTES:

        raise ValueError(
            f"Dificuldade inválida: {difficulty}"
        )

    # --------------------------------------------------------
    # CARREGA MIDI
    # --------------------------------------------------------

    try:

        mid = mido.MidiFile(
            midi_path,
            clip=True
        )

    except Exception:

        mid = mido.MidiFile(
            midi_path
        )

    # --------------------------------------------------------
    # TRACK GUITAR
    # --------------------------------------------------------

    target_track = find_guitar_track(mid)

    # --------------------------------------------------------
    # MAPA DAS NOTAS DA DIFICULDADE
    # --------------------------------------------------------

    note_to_lane = DIFFICULTY_NOTES[difficulty]

    # --------------------------------------------------------
    # MAPA DE TEMPO
    # --------------------------------------------------------

    tempo_map = build_tempo_map(mid)

    ticks_per_beat = mid.ticks_per_beat

    # --------------------------------------------------------
    # PROCESSA NOTAS
    # --------------------------------------------------------

    notes = []

    active_notes = {}

    current_tick = 0

    for msg in target_track:

        # O msg.time é DELTA TIME.
        current_tick += msg.time

        # ====================================================
        # NOTE ON
        # ====================================================

        if (
            msg.type == "note_on"
            and msg.velocity > 0
        ):

            midi_note = msg.note

            # Ignora notas de outras dificuldades
            if midi_note not in note_to_lane:
                continue

            # Evita duplicar NOTE ON
            if midi_note in active_notes:
                continue

            start_tick = current_tick

            start_seconds = tick_to_seconds(
                start_tick,
                tempo_map,
                ticks_per_beat
            )

            active_notes[midi_note] = {
                "tick": start_tick,
                "time": start_seconds,
                "lane": note_to_lane[midi_note]
            }

        # ====================================================
        # NOTE OFF
        # ====================================================

        elif (
            msg.type == "note_off"
            or (
                msg.type == "note_on"
                and msg.velocity == 0
            )
        ):

            midi_note = msg.note

            if midi_note not in active_notes:
                continue

            note_data = active_notes.pop(
                midi_note
            )

            end_tick = current_tick

            end_seconds = tick_to_seconds(
                end_tick,
                tempo_map,
                ticks_per_beat
            )

            duration = (
                end_seconds
                - note_data["time"]
            )

            # Pequenas durações são consideradas
            # notas normais.
            if duration < 0.01:
                duration = 0.0

            notes.append(
                {
                    "time": round(
                        note_data["time"],
                        3
                    ),

                    "lane": note_data["lane"],

                    "duration": round(
                        duration,
                        3
                    )
                }
            )

    # ========================================================
    # NOTAS QUE NÃO POSSUEM NOTE OFF
    # ========================================================

    for note_data in active_notes.values():

        notes.append(
            {
                "time": round(
                    note_data["time"],
                    3
                ),

                "lane": note_data["lane"],

                "duration": 0.0
            }
        )

    # ========================================================
    # ORDENA
    # ========================================================

    notes.sort(
        key=lambda note: (
            note["time"],
            note["lane"]
        )
    )

    return notes


# ============================================================
# COMPATIBILIDADE COM O RESTO DO PROJETO
# ============================================================

def parse_midi_file_advanced(
    midi_path
):
    """
    Mantém compatibilidade com o código antigo.

    Por padrão retorna Expert.
    """

    return parse_midi_difficulty(
        midi_path,
        "expert"
    )


def parse_midi_file(
    midi_path,
    track_name=None
):
    return parse_midi_file_advanced(
        midi_path
    )
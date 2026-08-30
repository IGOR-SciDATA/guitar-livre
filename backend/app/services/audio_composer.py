"""Compositor determinístico de charts a partir do áudio.

Este módulo não usa modelo treinado, probabilidades nem aleatoriedade. Ele
transforma sinais musicais mensuráveis em uma chart jogável: grade rítmica,
ataques, energia, espectro e frases. O Enchor continua sendo a fonte preferida
quando existir uma chart humana.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import librosa
import numpy as np


LANES = 5
HOP_LENGTH = 512
DIFFICULTIES = ("easy", "medium", "hard", "expert")

DIFFICULTY_RULES = {
    "easy": {
        "max_lane": 2,
        "min_spacing": 0.48,
        "max_chord_size": 1,
        "keep_ratio": 0.40,
        "allow_sustains": False,
    },
    "medium": {
        "max_lane": 3,
        "min_spacing": 0.32,
        "max_chord_size": 1,
        "keep_ratio": 0.58,
        "allow_sustains": True,
    },
    "hard": {
        "max_lane": 4,
        "min_spacing": 0.22,
        "max_chord_size": 2,
        "keep_ratio": 0.76,
        "allow_sustains": True,
    },
    "expert": {
        "max_lane": 4,
        "min_spacing": 0.12,
        "max_chord_size": 2,
        "keep_ratio": 1.0,
        "allow_sustains": True,
    },
}


def _normalize(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=float)
    if not values.size:
        return values

    low = float(np.percentile(values, 5))
    high = float(np.percentile(values, 95))
    if high - low < 1e-9:
        return np.zeros_like(values)

    return np.clip((values - low) / (high - low), 0.0, 1.0)


def _as_float(value, default: float = 120.0) -> float:
    array = np.asarray(value).reshape(-1)
    return float(array[0]) if array.size else default


def _build_beat_grid(beats: np.ndarray, duration: float) -> list[tuple[float, int, int]]:
    """Cria candidatos em semicolcheias, preservando índice de beat e subdivisão."""
    if beats.size < 2:
        interval = 60.0 / 120.0
        beats = np.arange(0.0, duration + interval, interval)

    candidates: list[tuple[float, int, int]] = []
    for beat_index in range(len(beats) - 1):
        start = float(beats[beat_index])
        end = float(beats[beat_index + 1])
        interval = end - start
        if interval <= 0:
            continue

        for subdivision in range(4):
            candidates.append((start + interval * subdivision / 4, beat_index, subdivision))

    return candidates


def _section_density(beat_index: int, total_beats: int, section_energy: float) -> float:
    """Densidade musical por trecho; abertura e encerramento são mais simples."""
    position = beat_index / max(1, total_beats - 1)
    if position < 0.08:
        return 0.42
    if position > 0.93:
        return 0.48
    if section_energy < 0.32:
        return 0.45
    if section_energy > 0.68:
        return 0.70
    return 0.58


def _build_sections(beat_energies: np.ndarray) -> list[dict]:
    """Divide a música em frases de quatro compassos e identifica papel por energia."""
    if not beat_energies.size:
        return []

    section_size = 16
    sections: list[dict] = []
    count = len(beat_energies)
    for start in range(0, count, section_size):
        end = min(count, start + section_size)
        energy = float(np.mean(beat_energies[start:end]))
        position = start / max(1, count - 1)

        if start == 0:
            name = "intro"
        elif end == count:
            name = "outro"
        elif energy < 0.30:
            name = "break"
        elif energy > 0.68:
            name = "chorus"
        else:
            name = "verse"

        sections.append({"start": start, "end": end, "energy": energy, "name": name, "position": position})

    return sections


def _section_for_beat(sections: list[dict], beat_index: int) -> dict:
    for section in sections:
        if section["start"] <= beat_index < section["end"]:
            return section
    return sections[-1] if sections else {"energy": 0.5, "name": "section"}


def analyze_audio_structure(audio_path: str) -> dict:
    """Extrai somente sinais musicais usados pelo compositor determinístico."""
    print("[Guitar Livre] Analisando ritmo, energia e estrutura musical...")
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    onset_envelope = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP_LENGTH, aggregate=np.median)
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_envelope,
        sr=sr,
        hop_length=HOP_LENGTH,
        units="frames",
        trim=False,
    )
    bpm = _as_float(tempo)
    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP_LENGTH)

    if len(beats) < 2:
        beat_interval = 60.0 / bpm
        beats = np.arange(0.0, duration + beat_interval, beat_interval)

    rms = librosa.feature.rms(y=y, hop_length=HOP_LENGTH)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=HOP_LENGTH)[0]
    harmonic, _ = librosa.effects.hpss(y)
    harmonic_rms = librosa.feature.rms(y=harmonic, hop_length=HOP_LENGTH)[0]

    onset_norm = _normalize(onset_envelope)
    rms_norm = _normalize(rms)
    centroid_norm = _normalize(centroid)
    harmonic_norm = _normalize(harmonic_rms)
    frame_times = librosa.frames_to_time(np.arange(len(onset_norm)), sr=sr, hop_length=HOP_LENGTH)

    beat_energies = []
    for time in beats:
        index = int(np.argmin(np.abs(frame_times - time)))
        beat_energies.append(rms_norm[index])

    sections = _build_sections(np.asarray(beat_energies))
    print(f"[Guitar Livre] BPM: {bpm:.2f}; beats: {len(beats)}; seções: {len(sections)}")

    return {
        "bpm": bpm,
        "duration": duration,
        "beats": np.asarray(beats),
        "frame_times": frame_times,
        "onset": onset_norm,
        "rms": rms_norm,
        "centroid": centroid_norm,
        "harmonic": harmonic_norm,
        "sections": sections,
        "beat_energies": np.asarray(beat_energies),
    }


def _feature_at(analysis: dict, time: float) -> tuple[float, float, float, float]:
    frame_times = analysis["frame_times"]
    index = int(np.argmin(np.abs(frame_times - time)))
    onset = float(analysis["onset"][index])
    rms = float(analysis["rms"][index])
    centroid = float(analysis["centroid"][index])
    harmonic = float(analysis["harmonic"][index])
    return onset, rms, centroid, harmonic


def _nearest_onset_strength(analysis: dict, time: float, window: float = 0.085) -> tuple[float, float, float, float, float]:
    frame_times = analysis["frame_times"]
    mask = np.abs(frame_times - time) <= window
    indexes = np.flatnonzero(mask)
    if not indexes.size:
        onset, rms, centroid, harmonic = _feature_at(analysis, time)
        return time, onset, rms, centroid, harmonic

    onset_values = analysis["onset"][indexes]
    index = int(indexes[int(np.argmax(onset_values))])
    return (
        float(frame_times[index]),
        float(analysis["onset"][index]),
        float(analysis["rms"][index]),
        float(analysis["centroid"][index]),
        float(analysis["harmonic"][index]),
    )


def _lane_for_event(centroid: float, beat_index: int, subdivision: int, section: dict) -> int:
    """Relaciona brilho espectral e direção de frase a uma lane estável."""
    spectral_lane = int(np.clip(np.floor(centroid * LANES), 0, LANES - 1))
    phrase_step = (beat_index // 2 + subdivision + (1 if section["name"] == "chorus" else 0)) % 3 - 1
    return int(np.clip(spectral_lane + phrase_step, 0, LANES - 1))


def compose_expert_chart(analysis: dict) -> list[dict]:
    candidates = _build_beat_grid(analysis["beats"], analysis["duration"])
    total_beats = max(1, len(analysis["beats"]))
    events: list[dict] = []
    last_time = -999.0

    for grid_time, beat_index, subdivision in candidates:
        event_time, onset, rms, centroid, harmonic = _nearest_onset_strength(analysis, grid_time)
        section = _section_for_beat(analysis["sections"], beat_index)
        density = _section_density(beat_index, total_beats, section["energy"])
        downbeat_bonus = 0.11 if subdivision == 0 else 0.0
        score = 0.67 * onset + 0.23 * rms + 0.10 * harmonic + downbeat_bonus
        threshold = 0.62 - density * 0.20

        if score < threshold or event_time - last_time < 0.115:
            continue

        lane = _lane_for_event(centroid, beat_index, subdivision, section)
        events.append({
            "time": round(grid_time, 3),
            "lane": lane,
            "duration": 0.0,
            "strength": score,
            "beat_index": beat_index,
            "subdivision": subdivision,
            "section": section["name"],
        })
        last_time = grid_time

    if not events:
        # Mantém uma chart utilizável mesmo para material com ataques muito suaves.
        for grid_time, beat_index, subdivision in candidates[::4]:
            _, onset, rms, centroid, _ = _nearest_onset_strength(analysis, grid_time)
            if onset + rms < 0.18:
                continue
            section = _section_for_beat(analysis["sections"], beat_index)
            events.append({
                "time": round(grid_time, 3),
                "lane": _lane_for_event(centroid, beat_index, subdivision, section),
                "duration": 0.0,
                "strength": onset + rms,
                "beat_index": beat_index,
                "subdivision": subdivision,
                "section": section["name"],
            })

    _add_chords_and_sustains(events, analysis)
    return sorted(events, key=lambda event: (event["time"], event["lane"]))


def _add_chords_and_sustains(events: list[dict], analysis: dict) -> None:
    """Adiciona acordes e sustains apenas em sinais fortes e determinísticos."""
    original_events = list(events)
    for index, event in enumerate(original_events):
        next_time = original_events[index + 1]["time"] if index + 1 < len(original_events) else analysis["duration"]
        gap = max(0.0, next_time - event["time"])

        if event["strength"] >= 0.86 and event["subdivision"] == 0:
            companion = event["lane"] + (1 if event["lane"] < 2 else -1)
            if 0 <= companion < LANES:
                events.append({**event, "lane": companion, "strength": event["strength"] - 0.01})

        if gap >= 0.70 and event["strength"] >= 0.56:
            event["duration"] = round(min(gap * 0.62, 1.60), 3)


def _group_events(events: list[dict]) -> list[list[dict]]:
    grouped: dict[float, list[dict]] = defaultdict(list)
    for event in events:
        grouped[round(float(event["time"]), 3)].append(event)
    return [grouped[time] for time in sorted(grouped)]


def reduce_difficulty(expert_events: list[dict], difficulty: str) -> list[dict]:
    """Reduz a expert mantendo a mesma música e as cores permitidas."""
    rules = DIFFICULTY_RULES[difficulty]
    output: list[dict] = []
    last_time = -999.0

    for group in _group_events(expert_events):
        event_time = group[0]["time"]
        strongest = max(group, key=lambda event: event["strength"])
        is_downbeat = strongest["subdivision"] == 0
        keep_threshold = 1.0 - rules["keep_ratio"]

        if strongest["strength"] < keep_threshold and not is_downbeat:
            continue
        if event_time - last_time < rules["min_spacing"]:
            continue

        selected = sorted(group, key=lambda event: event["strength"], reverse=True)[:rules["max_chord_size"]]
        lanes_seen: set[int] = set()
        for event in selected:
            lane = min(int(event["lane"]), rules["max_lane"])
            if lane in lanes_seen:
                continue
            lanes_seen.add(lane)

            duration = float(event.get("duration", 0.0))
            if not rules["allow_sustains"]:
                duration = 0.0
            elif duration:
                duration = round(min(duration, 1.25), 3)

            output.append({"time": event_time, "lane": lane, "duration": duration})

        if lanes_seen:
            last_time = event_time

    return output


def _serialize_events(events: list[dict]) -> list[dict]:
    return [
        {
            "time": round(float(event["time"]), 3),
            "lane": int(event["lane"]),
            "duration": round(float(event.get("duration", 0.0)), 3),
        }
        for event in events
    ]


def compose_charts(audio_path: str, song_folder: str) -> dict[str, dict]:
    """Gera expert e suas reduções, salvando as quatro dificuldades."""
    analysis = analyze_audio_structure(audio_path)
    expert_events = compose_expert_chart(analysis)
    song_dir = Path(song_folder)
    charts: dict[str, dict] = {}

    for difficulty in DIFFICULTIES:
        events = expert_events if difficulty == "expert" else reduce_difficulty(expert_events, difficulty)
        chart = {
            "version": 2,
            "difficulty": difficulty,
            "bpm": round(float(analysis["bpm"]), 2),
            "duration": round(float(analysis["duration"]), 3),
            "lanes": LANES,
            "notes": _serialize_events(events),
            "source": "audio_composed",
        }
        output_path = song_dir / f"chart_{difficulty}.json"
        output_path.write_text(json.dumps(chart, ensure_ascii=False, indent=4), encoding="utf-8")
        charts[difficulty] = chart
        print(f"[Guitar Livre] Chart {difficulty} composta: {len(chart['notes'])} notas.")

    return charts

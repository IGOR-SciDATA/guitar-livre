import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.storage import STORAGE_ROOT

router = APIRouter(prefix="/api/rankings", tags=["rankings"])

RANKINGS_FILE = STORAGE_ROOT / "rankings.json"


class ScoreSubmission(BaseModel):
    username: str
    score: int
    difficulty: str
    maxCombo: int


def load_rankings():
    if not RANKINGS_FILE.exists():
        return {}
    try:
        with open(RANKINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_rankings(rankings):
    RANKINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RANKINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(rankings, f, ensure_ascii=False, indent=4)


@router.get("/{song_id}")
def get_ranking(song_id: str):
    rankings = load_rankings()
    song_scores = rankings.get(song_id, [])
    sorted_scores = sorted(song_scores, key=lambda x: x["score"], reverse=True)
    return sorted_scores[:10]


@router.get("/{song_id}/user/{username}")
def get_user_score(song_id: str, username: str):
    """Retorna a melhor pontuação do usuário para uma música específica."""
    rankings = load_rankings()
    song_scores = rankings.get(song_id, [])
    user_entries = [entry for entry in song_scores if entry["username"].lower() == username.lower()]

    if not user_entries:
        return {"score": 0, "maxCombo": 0}

    # Ordena por score decrescente e retorna a primeira (maior pontuação)
    best = sorted(user_entries, key=lambda x: x["score"], reverse=True)[0]
    return {
        "score": best["score"],
        "maxCombo": best.get("maxCombo", 0),
        "difficulty": best.get("difficulty", ""),
    }


@router.post("/{song_id}")
def submit_score(song_id: str, submission: ScoreSubmission):
    if submission.score < 0:
        raise HTTPException(status_code=400, detail="Pontuação inválida.")

    rankings = load_rankings()
    if song_id not in rankings:
        rankings[song_id] = []

    entry = {
        "username": submission.username,
        "score": submission.score,
        "difficulty": submission.difficulty,
        "maxCombo": submission.maxCombo,
        "date": datetime.now(timezone.utc).isoformat(),
    }

    rankings[song_id].append(entry)
    rankings[song_id] = sorted(
        rankings[song_id],
        key=lambda x: x["score"],
        reverse=True,
    )[:50]

    save_rankings(rankings)
    return {"status": "ok", "ranking": rankings[song_id][:10]}

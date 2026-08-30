import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.storage import STORAGE_ROOT

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = STORAGE_ROOT / "settings.json"

DEFAULT_SETTINGS = {
    "volume": 70,
    "disableVideo": False,
    "keyBindings": ["A", "S", "D", "F", "G"],
}

class SettingsUpdate(BaseModel):
    volume: int | None = None
    disableVideo: bool | None = None
    keyBindings: list[str] | None = None


def load_settings():
    if not SETTINGS_FILE.exists():
        return {}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_settings(settings):
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=4)


@router.get("/{username}")
def get_settings(username: str):
    settings = load_settings()
    return settings.get(username, DEFAULT_SETTINGS)


@router.put("/{username}")
def update_settings(username: str, update: SettingsUpdate):
    settings = load_settings()
    current = settings.get(username, DEFAULT_SETTINGS.copy())

    if update.volume is not None:
        current["volume"] = update.volume
    if update.disableVideo is not None:
        current["disableVideo"] = update.disableVideo
    if update.keyBindings is not None:
        if len(update.keyBindings) != 5:
            raise HTTPException(status_code=400, detail="keyBindings deve ter 5 elementos")
        current["keyBindings"] = [k.upper() for k in update.keyBindings]

    settings[username] = current
    save_settings(settings)
    return current

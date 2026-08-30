import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import bcrypt
from app.services.storage import STORAGE_ROOT

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERS_FILE = STORAGE_ROOT / "users.json"


class UserCredentials(BaseModel):
    username: str
    password: str


def load_users():
    if not USERS_FILE.exists():
        return []
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_users(users):
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=4)


@router.post("/register")
def register(credentials: UserCredentials):
    username = credentials.username.strip()
    password = credentials.password.strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Preencha todos os campos.")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Usuário deve ter pelo menos 3 caracteres.")

    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 4 caracteres.")

    users = load_users()
    if any(u["username"].lower() == username.lower() for u in users):
        raise HTTPException(status_code=400, detail="Este usuário já existe.")

    # Gera hash bcrypt
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    new_user = {
        "username": username,
        "password_hash": hashed.decode("utf-8"),
    }
    users.append(new_user)
    save_users(users)

    return {"username": username}


@router.post("/login")
def login(credentials: UserCredentials):
    username = credentials.username.strip()
    password = credentials.password.strip()

    users = load_users()
    user = next((u for u in users if u["username"].lower() == username.lower()), None)

    if not user:
        raise HTTPException(status_code=400, detail="Usuário não encontrado.")

    stored_hash = user.get("password_hash", "")
    if not stored_hash:
        # Compatibilidade com senhas antigas em texto puro (se houver)
        if user.get("password") != password:
            raise HTTPException(status_code=400, detail="Senha incorreta.")
    else:
        if not bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
            raise HTTPException(status_code=400, detail="Senha incorreta.")

    return {"username": user["username"]}

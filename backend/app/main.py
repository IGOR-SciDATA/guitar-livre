import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes.songs import router as songs_router
from app.routes.auth import router as auth_router
from app.routes.settings import router as settings_router
from app.routes.rankings import router as rankings_router
from app.services.storage import STORAGE_ROOT


def get_cors_origins():
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="Guitar Livre API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs_router)
app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(rankings_router)

STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=str(STORAGE_ROOT)), name="storage")


@app.get("/")
def root():
    return {"name": "Guitar Livre", "status": "online", "version": app.version}


@app.get("/api/health")
def health():
    return {"status": "ok"}

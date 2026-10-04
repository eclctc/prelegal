"""FastAPI application: API routes plus the statically built frontend."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import db
from app.auth_routes import router as auth_router
from app.chat_routes import router as chat_router

STATIC_DIR = Path(os.environ.get("STATIC_DIR", "static"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.reset_database(db.DB_PATH)
    yield


app = FastAPI(title="Prelegal", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(chat_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

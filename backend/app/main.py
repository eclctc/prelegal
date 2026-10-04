"""FastAPI application: API routes plus the statically built frontend."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import db

STATIC_DIR = Path(os.environ.get("STATIC_DIR", "static"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.reset_database(db.DB_PATH)
    yield


app = FastAPI(title="Prelegal", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

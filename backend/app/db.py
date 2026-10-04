"""SQLite access. The database is recreated from scratch on every startup."""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/prelegal.db")

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


def reset_database(db_path: Path = DB_PATH) -> None:
    """Delete any existing database file and create an empty schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.execute(SCHEMA)

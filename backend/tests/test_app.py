import sqlite3

from fastapi.testclient import TestClient

from app import db
from app.db import reset_database


def test_reset_database_creates_empty_users_table(tmp_path):
    db_path = tmp_path / "test.db"
    reset_database(db_path)
    with sqlite3.connect(db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone() == (0,)


def test_reset_database_discards_previous_data(tmp_path):
    db_path = tmp_path / "test.db"
    reset_database(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("INSERT INTO users (email, password_hash) VALUES ('a@b.com', 'x')")
    reset_database(db_path)
    with sqlite3.connect(db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone() == (0,)


def test_health_and_startup_creates_database(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "data" / "prelegal.db")
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
    assert (tmp_path / "data" / "prelegal.db").exists()


def test_static_frontend_served_at_root(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "data" / "prelegal.db")
    (tmp_path / "index.html").write_text("<html>hello</html>")
    monkeypatch.setenv("STATIC_DIR", str(tmp_path))
    import importlib

    import app.main

    reloaded = importlib.reload(app.main)
    with TestClient(reloaded.app) as client:
        assert "hello" in client.get("/").text
        assert client.get("/api/health").status_code == 200

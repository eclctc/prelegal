import pytest
from fastapi.testclient import TestClient

from app import db

CREDENTIALS = {"email": "ann@example.com", "password": "correct horse"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    """TestClient on a fresh temporary database (not signed in)."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def signed_in_client(client):
    client.post("/api/auth/signup", json=CREDENTIALS)
    return client

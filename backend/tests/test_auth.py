"""Sign up, sign in, sign out and session enforcement."""

import sqlite3

from fastapi.testclient import TestClient

from app import db
from tests.conftest import CREDENTIALS


def test_signup_signs_the_user_in(client):
    response = client.post("/api/auth/signup", json=CREDENTIALS)
    assert response.status_code == 201
    assert client.get("/api/auth/me").json() == {"email": "ann@example.com"}


def test_password_is_stored_hashed(client):
    client.post("/api/auth/signup", json=CREDENTIALS)
    with sqlite3.connect(db.DB_PATH) as connection:
        stored = connection.execute("SELECT password_hash FROM users").fetchone()[0]
    assert CREDENTIALS["password"] not in stored


def test_session_cookie_is_httponly(client):
    response = client.post("/api/auth/signup", json=CREDENTIALS)
    assert "httponly" in response.headers["set-cookie"].lower()


def test_duplicate_email_is_rejected_case_insensitively(client):
    client.post("/api/auth/signup", json=CREDENTIALS)
    again = client.post("/api/auth/signup", json={**CREDENTIALS, "email": "ANN@Example.com"})
    assert again.status_code == 409


def test_weak_or_malformed_credentials_are_rejected(client):
    assert client.post("/api/auth/signup", json={**CREDENTIALS, "password": "short"}).status_code == 422
    assert client.post("/api/auth/signup", json={**CREDENTIALS, "email": "nope"}).status_code == 422


def test_login_with_correct_password_works_from_a_new_browser(client):
    client.post("/api/auth/signup", json=CREDENTIALS)
    other_browser = TestClient(client.app)  # no context manager: the lifespan would reset the DB
    assert other_browser.get("/api/auth/me").status_code == 401
    assert other_browser.post("/api/auth/login", json=CREDENTIALS).status_code == 200
    assert other_browser.get("/api/auth/me").status_code == 200


def test_login_failure_does_not_reveal_which_part_was_wrong(client):
    client.post("/api/auth/signup", json=CREDENTIALS)
    wrong_password = client.post("/api/auth/login", json={**CREDENTIALS, "password": "wrong password"})
    unknown_email = client.post("/api/auth/login", json={**CREDENTIALS, "email": "bob@example.com"})
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_logout_ends_the_session(signed_in_client):
    assert signed_in_client.post("/api/auth/logout").status_code == 204
    assert signed_in_client.get("/api/auth/me").status_code == 401


def test_me_and_chat_require_a_session(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/chat", json={"messages": [], "fields": {}}).status_code == 401

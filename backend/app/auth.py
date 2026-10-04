"""Password hashing and cookie-based sessions."""

import hashlib
import hmac
import secrets
import sqlite3
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException

from app.db import get_connection

SESSION_COOKIE = "session"
SESSION_MAX_AGE_SECONDS = 7 * 24 * 3600

# scope="function" makes the commit in get_connection run before the response is sent, so a client
# that immediately follows one write with another request always sees the committed data.
Connection = Annotated[sqlite3.Connection, Depends(get_connection, scope="function")]


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split("$")
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
    return hmac.compare_digest(digest, bytes.fromhex(digest_hex))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(connection: sqlite3.Connection, user_id: int) -> str:
    """Store a new session and return the raw token for the cookie (only its hash is stored)."""
    token = secrets.token_urlsafe(32)
    connection.execute("INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)", (_token_hash(token), user_id))
    return token


def delete_session(connection: sqlite3.Connection, token: str) -> None:
    connection.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def find_user(connection: sqlite3.Connection, session: str | None) -> sqlite3.Row | None:
    """The user a session cookie belongs to, or None."""
    if not session:
        return None
    return connection.execute(
        "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
        "WHERE sessions.token_hash = ? AND sessions.created_at > datetime('now', ?)",
        (_token_hash(session), f"-{SESSION_MAX_AGE_SECONDS} seconds"),
    ).fetchone()


def current_user(connection: Connection, session: Annotated[str | None, Cookie()] = None) -> sqlite3.Row:
    """Dependency: the signed-in user, or 401."""
    row = find_user(connection, session)
    if row is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return row


CurrentUser = Annotated[sqlite3.Row, Depends(current_user)]

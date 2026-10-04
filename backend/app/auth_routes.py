"""Sign up, sign in, sign out and current-user routes."""

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel, Field

from app import auth
from app.auth import Connection

router = APIRouter(prefix="/api/auth")


class Credentials(BaseModel):
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)


def _start_session(response: Response, connection: sqlite3.Connection, user_id: int) -> None:
    token = auth.create_session(connection, user_id)
    response.set_cookie(
        auth.SESSION_COOKIE, token, max_age=auth.SESSION_MAX_AGE_SECONDS, httponly=True, samesite="lax"
    )


@router.post("/signup", status_code=201)
def signup(credentials: Credentials, response: Response, connection: Connection) -> dict:
    email = credentials.email.lower()
    try:
        cursor = connection.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, auth.hash_password(credentials.password)),
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists") from None
    _start_session(response, connection, cursor.lastrowid)
    return {"email": email}


@router.post("/login")
def login(credentials: Credentials, response: Response, connection: Connection) -> dict:
    email = credentials.email.lower()
    row = connection.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not auth.verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _start_session(response, connection, row["id"])
    return {"email": email}


@router.post("/logout", status_code=204)
def logout(response: Response, connection: Connection, session: Annotated[str | None, Cookie()] = None) -> None:
    if session:
        auth.delete_session(connection, session)
    response.delete_cookie(auth.SESSION_COOKIE)


@router.get("/me")
def me(connection: Connection, session: Annotated[str | None, Cookie()] = None) -> dict:
    """The signed-in email, or null. Returns 200 either way so a signed-out page load is not an error."""
    user = auth.find_user(connection, session)
    return {"email": user["email"] if user else None}

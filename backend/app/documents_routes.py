"""Routes for a signed-in user's saved documents."""

import json
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app import documents
from app.auth import Connection, CurrentUser
from app.llm import ChatMessage

router = APIRouter(prefix="/api/documents")

DocumentType = Literal[tuple(documents.DOCUMENTS)]
MAX_FIELDS_JSON_CHARS = 100_000


class DocumentBody(BaseModel):
    documentType: DocumentType
    fields: dict
    messages: list[ChatMessage] = Field(max_length=500)

    @field_validator("fields")
    @classmethod
    def fields_not_huge(cls, fields: dict) -> dict:
        if len(json.dumps(fields)) > MAX_FIELDS_JSON_CHARS:
            raise ValueError("fields are too large")
        return fields


def _serialize(row, *, with_messages: bool) -> dict:
    result = {
        "id": row["id"],
        "documentType": row["document_type"],
        "fields": json.loads(row["fields"]),
        "updatedAt": row["updated_at"],
    }
    if with_messages:
        result["messages"] = json.loads(row["messages"])
    return result


def _owned_row(connection, user, document_id: int):
    row = connection.execute(
        "SELECT * FROM saved_documents WHERE id = ? AND user_id = ?", (document_id, user["id"])
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return row


@router.post("", status_code=201)
def create_document(body: DocumentBody, connection: Connection, user: CurrentUser) -> dict:
    cursor = connection.execute(
        "INSERT INTO saved_documents (user_id, document_type, fields, messages) VALUES (?, ?, ?, ?)",
        (user["id"], body.documentType, json.dumps(body.fields), json.dumps([m.model_dump() for m in body.messages])),
    )
    return {"id": cursor.lastrowid}


@router.get("")
def list_documents(connection: Connection, user: CurrentUser) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM saved_documents WHERE user_id = ? ORDER BY updated_at DESC, id DESC", (user["id"],)
    ).fetchall()
    return [_serialize(row, with_messages=False) for row in rows]


@router.get("/{document_id}")
def get_document(document_id: int, connection: Connection, user: CurrentUser) -> dict:
    return _serialize(_owned_row(connection, user, document_id), with_messages=True)


@router.put("/{document_id}")
def update_document(document_id: int, body: DocumentBody, connection: Connection, user: CurrentUser) -> dict:
    _owned_row(connection, user, document_id)
    connection.execute(
        "UPDATE saved_documents SET document_type = ?, fields = ?, messages = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') "
        "WHERE id = ?",
        (body.documentType, json.dumps(body.fields), json.dumps([m.model_dump() for m in body.messages]), document_id),
    )
    return {"id": document_id}


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, connection: Connection, user: CurrentUser) -> None:
    _owned_row(connection, user, document_id)
    connection.execute("DELETE FROM saved_documents WHERE id = ?", (document_id,))

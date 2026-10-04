"""Document specs shared with the frontend (documents.json at the repo root)."""

import json
import os
from functools import cache
from pathlib import Path

from pydantic import BaseModel, Field, create_model

DOCUMENTS_PATH = Path(os.environ.get("DOCUMENTS_PATH", Path(__file__).parents[2] / "documents.json"))
NDA_ID = "mutual-nda"
DOCUMENTS: dict[str, dict] = {d["id"]: d for d in json.loads(DOCUMENTS_PATH.read_text())}


def catalog_text() -> str:
    """One line per supported document, for the document-selection prompt."""
    return "\n".join(f"- {d['id']}: {d['name']} - {d['description']}" for d in DOCUMENTS.values())


def fields_text(document_id: str) -> str:
    """One line per field of a generic document, for the drafting prompt."""
    return "\n".join(
        f"- {f['key']}{' (optional)' if f.get('optional') else ''}: {f['hint']}"
        for f in DOCUMENTS[document_id]["fields"]
    )


def missing_required(document_id: str, values: dict) -> list[str]:
    """Required field keys of a generic document that have no value yet."""
    return [
        f["key"]
        for f in DOCUMENTS[document_id]["fields"]
        if not f.get("optional") and not str(values.get(f["key"]) or "").strip()
    ]


@cache
def reply_model(document_id: str) -> type[BaseModel]:
    """Structured-output model for a generic document: every spec field is an optional string.

    Field keys contain spaces, so each is stored under a safe attribute name with the key as alias.
    """
    attributes = {
        f"field_{i}": (str | None, Field(default=None, alias=f["key"]))
        for i, f in enumerate(DOCUMENTS[document_id]["fields"])
    }
    fields = create_model("Fields", **attributes)
    return create_model("GenericReply", reply=(str, ...), fields=(fields, ...))

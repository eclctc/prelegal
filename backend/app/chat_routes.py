"""HTTP route for the document chat."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import documents, llm
from app.auth import CurrentUser

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    messages: list[llm.ChatMessage]
    documentType: Literal[tuple(documents.DOCUMENTS)] | None = None
    fields: dict


@router.post("/chat")
def chat(request: ChatRequest, _user: CurrentUser) -> llm.ChatResponse:
    """Plain def so FastAPI runs the blocking LLM call in its threadpool."""
    return llm.chat(request.messages, request.documentType, request.fields)

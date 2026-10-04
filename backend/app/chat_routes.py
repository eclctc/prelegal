"""HTTP route for the Mutual NDA chat."""

from fastapi import APIRouter
from pydantic import BaseModel

from app import llm

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    messages: list[llm.ChatMessage]
    fields: dict


@router.post("/chat")
def chat(request: ChatRequest) -> llm.ChatReply:
    """Plain def so FastAPI runs the blocking LLM call in its threadpool."""
    return llm.chat(request.messages, request.fields)

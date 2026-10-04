"""LLM access for the Mutual NDA chat: Cerebras via OpenRouter through LiteLLM."""

from datetime import date
from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You help a user draft a Mutual Non-Disclosure Agreement (Common Paper) through a friendly chat.
Ask about the document and its fields a few at a time, in plain language. Fields:
- purpose: how Confidential Information may be used
- effectiveDate: yyyy-mm-dd
- termKind: "expires" after termYears years, or "continues" until terminated
- confidentialityKind: "years" (confidentialityYears) or "perpetuity"
- governingLaw: the state whose law governs; jurisdiction: city/county and state of the courts
- modifications: any changes to the standard terms
- party1 and party2: name, title, company, notice (email or postal address for notices)
Each turn, put in `fields` only the values the user gave or confirmed in their latest message; leave everything else null.
Resolve relative dates such as "next Monday" to yyyy-mm-dd using today's date. Never invent values. In `reply`, acknowledge what you captured and ask for what is still missing.
When the essentials are filled, tell the user the document is ready to download."""


class PartyUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    notice: str | None = None


class FieldsUpdate(BaseModel):
    purpose: str | None = None
    effectiveDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    termKind: Literal["expires", "continues"] | None = None
    termYears: int | None = Field(default=None, ge=1, le=99)
    confidentialityKind: Literal["years", "perpetuity"] | None = None
    confidentialityYears: int | None = Field(default=None, ge=1, le=99)
    governingLaw: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    party1: PartyUpdate | None = None
    party2: PartyUpdate | None = None


class ChatReply(BaseModel):
    reply: str
    fields: FieldsUpdate


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


def chat(messages: list[ChatMessage], current_fields: dict) -> ChatReply:
    """Return the assistant reply and the field values learned in the latest turn."""
    system = f"{SYSTEM_PROMPT}\n\nToday's date: {date.today().isoformat()}\nCurrent field values: {current_fields}"
    history = [{"role": "system", "content": system}, *(m.model_dump() for m in messages)]
    response = completion(
        model=MODEL,
        messages=history,
        response_format=ChatReply,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    return ChatReply.model_validate_json(response.choices[0].message.content)

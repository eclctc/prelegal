"""LLM access for the document chat: Cerebras via OpenRouter through LiteLLM."""

from datetime import date
from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field, create_model

from app import documents

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

TURN_RULES = """Each turn, put in `fields` only the values the user gave or confirmed in their latest message; leave everything else null.
Resolve relative dates such as "next Monday" to a written-out date using today's date. Never invent values.
The current field values may include form defaults; defaults are not user choices. Only claim to have captured something the user actually said in the conversation.
In `reply`, briefly acknowledge what you captured. If any required field is still missing, you MUST end the reply with a direct question (a sentence ending in "?") asking for the next missing field(s). A statement such as "I still need X" is not enough; ask "What is X?" instead.
When all required fields are filled, tell the user the document is ready to download."""

NDA_PROMPT = f"""You help a user draft a Mutual Non-Disclosure Agreement (Common Paper) through a friendly chat.
Ask about the document and its fields one or two at a time, in plain language. Keep replies short. Fields:
- purpose: how Confidential Information may be used
- effectiveDate: yyyy-mm-dd
- termKind: "expires" after termYears years, or "continues" until terminated
- confidentialityKind: "years" (confidentialityYears) or "perpetuity"
- governingLaw: the state whose law governs; jurisdiction: city/county and state of the courts
- modifications: any changes to the standard terms (optional)
- party1 and party2: name, title, company, notice (email or postal address for notices)
Required: purpose, governingLaw, jurisdiction and every party1 and party2 value.
{TURN_RULES}
Use yyyy-mm-dd for effectiveDate. If the user has said nothing about the NDA yet, greet them briefly and ask what it is for."""

FINAL_REMINDER = "Reminder: unless every required field is now filled, your `reply` must finish with a question mark question about the next missing field."

GENERIC_PROMPT = """You help a user draft a {name} (Common Paper) through a friendly chat.
Ask for the fields one to three at a time, in plain language, grouping related ones. Keep replies short. Fields (all required unless marked optional):
{fields}
Parties are identified by legal company name.
{rules}
Required fields still missing before this turn: {missing}."""

SELECT_PROMPT = """You help a user choose a legal document to draft through a friendly chat. These are the only documents you can generate:
{catalog}
If the user has not said what they need, greet them briefly and ask what they want to draft, mentioning a few of the options.
If their need clearly matches one document, set documentType to its id and reply with a short confirmation.
If they ask for a document not in the list, say plainly that you cannot generate it, set documentType to null, and offer the closest document from the list, asking whether they want it.
If you are unsure which document fits, set documentType to null and ask a clarifying question. Always end the reply with a question when documentType is null."""


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
    content: str = Field(max_length=8000)


SelectReply = create_model(
    "SelectReply",
    reply=(str, ...),
    documentType=(Literal[tuple(documents.DOCUMENTS)] | None, None),
)


class ChatResponse(BaseModel):
    reply: str
    documentType: str | None
    fields: dict


def _complete(system: str, messages: list[ChatMessage], response_format: type[BaseModel]):
    history = [{"role": "system", "content": system}, *(m.model_dump() for m in messages)]
    response = completion(
        model=MODEL,
        messages=history,
        response_format=response_format,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    return response_format.model_validate_json(response.choices[0].message.content)


def _with_follow_up(reply: str, missing: list[str]) -> str:
    """Guarantee a question while required fields remain: models sometimes end on a statement."""
    if missing and not reply.rstrip().endswith("?"):
        return f"{reply.rstrip()} What is the {missing[0]}?"
    return reply


def _draft_turn(messages: list[ChatMessage], document_id: str, current_fields: dict) -> ChatResponse:
    context = f"\n\nToday's date: {date.today().isoformat()}\nCurrent field values: {current_fields}\n\n{FINAL_REMINDER}"
    if document_id == documents.NDA_ID:
        result = _complete(NDA_PROMPT + context, messages, ChatReply)
        fields = result.fields.model_dump()
        missing = documents.nda_missing_required(documents.merge_updates(current_fields, fields))
    else:
        prompt = GENERIC_PROMPT.format(
            name=documents.DOCUMENTS[document_id]["name"],
            fields=documents.fields_text(document_id),
            rules=TURN_RULES,
            missing=", ".join(documents.missing_required(document_id, current_fields)) or "none",
        )
        result = _complete(prompt + context, messages, documents.reply_model(document_id))
        fields = result.fields.model_dump(by_alias=True)
        missing = documents.missing_required(document_id, documents.merge_updates(current_fields, fields))
    return ChatResponse(reply=_with_follow_up(result.reply, missing), documentType=document_id, fields=fields)


def chat(messages: list[ChatMessage], document_type: str | None, current_fields: dict) -> ChatResponse:
    """Return the assistant reply and the field values learned in the latest turn.

    With no document chosen yet, the model picks one from the catalog; once it does, the same
    user message is handled as the first drafting turn so the reply already asks for details.
    """
    if document_type is None:
        picked = _complete(SELECT_PROMPT.format(catalog=documents.catalog_text()), messages, SelectReply)
        if picked.documentType is None:
            return ChatResponse(reply=picked.reply, documentType=None, fields={})
        document_type = picked.documentType
    return _draft_turn(messages, document_type, current_fields)

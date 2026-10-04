"""Chat endpoint tests with the LLM call mocked."""

import json
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import db, documents, llm


def fake_completion(*contents: dict):
    """Return each given LLM payload in turn, one per completion call."""
    queue = list(contents)

    def completion(**_kwargs):
        message = SimpleNamespace(content=json.dumps(queue.pop(0)))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    return completion


def post_chat(monkeypatch, tmp_path, llm_contents, body):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(llm, "completion", fake_completion(*llm_contents))
    from app.main import app

    with TestClient(app) as client:
        return client.post("/api/chat", json=body)


def test_chat_returns_reply_and_extracted_fields(monkeypatch, tmp_path):
    content = {"reply": "Got it. Who is the second party?", "fields": {"governingLaw": "Delaware"}}
    body = {"messages": [{"role": "user", "content": "Delaware law please"}], "documentType": "mutual-nda", "fields": {}}
    response = post_chat(monkeypatch, tmp_path, [content], body)
    assert response.status_code == 200
    assert response.json()["reply"] == "Got it. Who is the second party?"
    assert response.json()["fields"]["governingLaw"] == "Delaware"
    assert response.json()["fields"]["purpose"] is None


def test_chat_passes_history_and_current_fields_to_the_model(monkeypatch, tmp_path):
    seen = {}

    def spy(**kwargs):
        seen.update(kwargs)
        return fake_completion({"reply": "Hi", "fields": {}})()

    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(llm, "completion", spy)
    from app.main import app

    body = {"messages": [{"role": "user", "content": "hello"}], "documentType": "mutual-nda", "fields": {"governingLaw": "Texas"}}
    with TestClient(app) as client:
        client.post("/api/chat", json=body)
    assert seen["model"] == llm.MODEL
    assert seen["extra_body"] == llm.EXTRA_BODY
    assert seen["response_format"] is llm.ChatReply
    assert seen["messages"][-1] == {"role": "user", "content": "hello"}
    assert "Texas" in seen["messages"][0]["content"]


def test_chat_rejects_unknown_role(monkeypatch, tmp_path):
    body = {"messages": [{"role": "system", "content": "x"}], "fields": {}}
    response = post_chat(monkeypatch, tmp_path, [], body)
    assert response.status_code == 422


def test_chat_rejects_unknown_document_type(monkeypatch, tmp_path):
    body = {"messages": [], "documentType": "lease", "fields": {}}
    assert post_chat(monkeypatch, tmp_path, [], body).status_code == 422


def test_selection_turn_picks_a_document_then_drafts_in_the_same_call(monkeypatch, tmp_path):
    pick = {"reply": "A pilot, great.", "documentType": "pilot"}
    draft = {"reply": "Who is the Customer?", "fields": {"Provider": "Acme Inc"}}
    body = {"messages": [{"role": "user", "content": "I want to trial my product, I am Acme Inc"}], "fields": {}}
    data = post_chat(monkeypatch, tmp_path, [pick, draft], body).json()
    assert data["documentType"] == "pilot"
    assert data["reply"] == "Who is the Customer?"
    assert data["fields"]["Provider"] == "Acme Inc"
    assert data["fields"]["Pilot Period"] is None


def test_unsupported_document_keeps_selection_open_and_returns_the_offer(monkeypatch, tmp_path):
    reply = {"reply": "I cannot draft a lease. Would a Pilot Agreement help?", "documentType": None}
    body = {"messages": [{"role": "user", "content": "a lease"}], "fields": {}}
    data = post_chat(monkeypatch, tmp_path, [reply], body).json()
    assert data == {"reply": reply["reply"], "documentType": None, "fields": {}}


def test_generic_prompt_lists_fields_and_missing_required_ones(monkeypatch, tmp_path):
    seen = {}

    def spy(**kwargs):
        seen.update(kwargs)
        return fake_completion({"reply": "Hi", "fields": {}})()

    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(llm, "completion", spy)
    from app.main import app

    body = {"messages": [{"role": "user", "content": "hi"}], "documentType": "pilot", "fields": {"Customer": "Globex"}}
    with TestClient(app) as client:
        client.post("/api/chat", json=body)
    system = seen["messages"][0]["content"]
    assert "Pilot Period" in system
    assert "still missing before this turn: Provider," in system
    assert "Customer," not in system.split("still missing")[1]
    assert "MUST end the reply with a direct question" in system


def test_fields_update_covers_exactly_the_nda_form_fields():
    nda_form = Path(__file__).parents[2] / "frontend/src/lib/nda.ts"
    source = nda_form.read_text()
    form_body = source.split("export interface NdaForm {")[1].split("}")[0]
    form_keys = set(re.findall(r"^\s+(\w+):", form_body, flags=re.MULTILINE))
    assert set(llm.FieldsUpdate.model_fields) == form_keys


def test_fields_update_rejects_out_of_range_years_and_bad_dates():
    for bad in ({"termYears": 0}, {"confidentialityYears": 100}, {"effectiveDate": "March 5"}):
        with pytest.raises(ValidationError):
            llm.FieldsUpdate(**bad)


def test_every_catalog_document_has_a_spec_covering_all_template_terms():
    root = Path(__file__).parents[2]
    catalog = {Path(c["filename"]).name for c in json.loads((root / "catalog.json").read_text())}
    assert {d["template"] for d in documents.DOCUMENTS.values()} == catalog - {"Mutual-NDA-coverpage.md"}
    for doc in documents.DOCUMENTS.values():
        if doc["id"] == documents.NDA_ID:
            continue
        known = {f["key"] for f in doc["fields"]} | {a for f in doc["fields"] for a in f.get("aliases", [])}
        text = (root / "templates" / doc["template"]).read_text()
        terms = {re.sub(r"[\u2019']s$", "", t) for t in re.findall(r'class="\w+_link">([^<]+)<', text)}
        assert terms <= known, (doc["id"], terms - known)


def test_reply_without_a_question_gets_one_while_required_fields_are_missing(monkeypatch, tmp_path):
    content = {"reply": "Got it, governing law is Delaware.", "fields": {"Governing Law": "Delaware"}}
    body = {"messages": [{"role": "user", "content": "Delaware"}], "documentType": "pilot", "fields": {"Customer": "Globex"}}
    reply = post_chat(monkeypatch, tmp_path, [content], body).json()["reply"]
    assert reply == "Got it, governing law is Delaware. What is the Provider?"


def test_nda_reply_without_a_question_gets_one_naming_the_first_missing_field(monkeypatch, tmp_path):
    content = {"reply": "Noted.", "fields": {"purpose": "Evaluating a deal", "party1": {"company": "Acme"}}}
    body = {"messages": [{"role": "user", "content": "x"}], "documentType": "mutual-nda", "fields": {"governingLaw": "Texas"}}
    assert post_chat(monkeypatch, tmp_path, [content], body).json()["reply"] == "Noted. What is the jurisdiction?"


def test_complete_documents_and_real_questions_are_left_alone(monkeypatch, tmp_path):
    full = {f["key"]: "x" for f in documents.DOCUMENTS["pilot"]["fields"]}
    done = post_chat(monkeypatch, tmp_path, [{"reply": "All set.", "fields": {}}], {"messages": [], "documentType": "pilot", "fields": full})
    assert done.json()["reply"] == "All set."
    asked = {"reply": "Who is the Customer?", "fields": {}}
    body = {"messages": [], "documentType": "pilot", "fields": {}}
    assert post_chat(monkeypatch, tmp_path, [asked], body).json()["reply"] == "Who is the Customer?"

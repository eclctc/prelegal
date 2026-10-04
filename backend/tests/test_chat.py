"""Chat endpoint tests with the LLM call mocked."""

import json
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import db, llm


def fake_completion(content: dict):
    def completion(**_kwargs):
        message = SimpleNamespace(content=json.dumps(content))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    return completion


def post_chat(monkeypatch, tmp_path, llm_content, body):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(llm, "completion", fake_completion(llm_content))
    from app.main import app

    with TestClient(app) as client:
        return client.post("/api/chat", json=body)


def test_chat_returns_reply_and_extracted_fields(monkeypatch, tmp_path):
    content = {"reply": "Got it. Who is the second party?", "fields": {"governingLaw": "Delaware"}}
    body = {"messages": [{"role": "user", "content": "Delaware law please"}], "fields": {}}
    response = post_chat(monkeypatch, tmp_path, content, body)
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

    body = {"messages": [{"role": "user", "content": "hello"}], "fields": {"governingLaw": "Texas"}}
    with TestClient(app) as client:
        client.post("/api/chat", json=body)
    assert seen["model"] == llm.MODEL
    assert seen["extra_body"] == llm.EXTRA_BODY
    assert seen["response_format"] is llm.ChatReply
    assert seen["messages"][-1] == {"role": "user", "content": "hello"}
    assert "Texas" in seen["messages"][0]["content"]


def test_chat_rejects_unknown_role(monkeypatch, tmp_path):
    body = {"messages": [{"role": "system", "content": "x"}], "fields": {}}
    response = post_chat(monkeypatch, tmp_path, {"reply": "", "fields": {}}, body)
    assert response.status_code == 422


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

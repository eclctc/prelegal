"""Saved documents: CRUD and per-user isolation."""

from fastapi.testclient import TestClient

BODY = {
    "documentType": "pilot",
    "fields": {"Customer": "Globex"},
    "messages": [{"role": "user", "content": "a pilot"}, {"role": "assistant", "content": "Who is the Provider?"}],
}


def test_routes_require_a_session(client):
    assert client.get("/api/documents").status_code == 401
    assert client.post("/api/documents", json=BODY).status_code == 401
    assert client.get("/api/documents/1").status_code == 401


def test_create_then_get_round_trips_fields_and_messages(signed_in_client):
    document_id = signed_in_client.post("/api/documents", json=BODY).json()["id"]
    saved = signed_in_client.get(f"/api/documents/{document_id}").json()
    assert saved["documentType"] == "pilot"
    assert saved["fields"] == BODY["fields"]
    assert saved["messages"] == BODY["messages"]


def test_update_replaces_content_and_list_is_newest_first(signed_in_client):
    first = signed_in_client.post("/api/documents", json=BODY).json()["id"]
    second = signed_in_client.post("/api/documents", json={**BODY, "documentType": "csa"}).json()["id"]
    signed_in_client.put(f"/api/documents/{first}", json={**BODY, "fields": {"Customer": "Initech"}})
    listing = signed_in_client.get("/api/documents").json()
    assert [d["id"] for d in listing] == [first, second]
    assert listing[0]["fields"] == {"Customer": "Initech"}
    assert "messages" not in listing[0]


def test_delete_removes_the_document(signed_in_client):
    document_id = signed_in_client.post("/api/documents", json=BODY).json()["id"]
    assert signed_in_client.delete(f"/api/documents/{document_id}").status_code == 204
    assert signed_in_client.get(f"/api/documents/{document_id}").status_code == 404


def test_users_cannot_see_change_or_delete_each_others_documents(signed_in_client):
    document_id = signed_in_client.post("/api/documents", json=BODY).json()["id"]
    bob = TestClient(signed_in_client.app)
    bob.post("/api/auth/signup", json={"email": "bob@example.com", "password": "another pass"})
    assert bob.get("/api/documents").json() == []
    assert bob.get(f"/api/documents/{document_id}").status_code == 404
    assert bob.put(f"/api/documents/{document_id}", json=BODY).status_code == 404
    assert bob.delete(f"/api/documents/{document_id}").status_code == 404
    assert signed_in_client.get(f"/api/documents/{document_id}").status_code == 200


def test_unknown_document_type_is_rejected(signed_in_client):
    assert signed_in_client.post("/api/documents", json={**BODY, "documentType": "lease"}).status_code == 422

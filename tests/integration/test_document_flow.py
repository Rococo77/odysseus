"""Critical flow: document CRUD (create → list → get → update/version → delete).

Exercises routes/document_routes.py through the real app + DB.
"""

import pytest

pytestmark = pytest.mark.integration


def _create_doc(client, title="Doc", content="hello world"):
    r = client.post("/api/document", json={"title": title, "content": content})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_create_and_list(client):
    did = _create_doc(client, "Listed doc")
    lib = client.get("/api/documents/library")
    assert lib.status_code == 200
    docs = lib.json()["documents"]
    assert any(d["id"] == did and d["title"] == "Listed doc" for d in docs)


def test_get_returns_content(client):
    did = _create_doc(client, "Readable", "the body text")
    r = client.get(f"/api/document/{did}")
    assert r.status_code == 200
    assert r.json()["current_content"] == "the body text"


def test_update_changes_content(client):
    did = _create_doc(client, "Editable", "v1 content")
    upd = client.put(f"/api/document/{did}", json={"content": "v2 content", "summary": "edit"})
    assert upd.status_code == 200
    assert client.get(f"/api/document/{did}").json()["current_content"] == "v2 content"
    versions = client.get(f"/api/document/{did}/versions").json()
    assert isinstance(versions, list) and len(versions) >= 1


def test_delete_removes_from_library(client):
    did = _create_doc(client, "Disposable")
    assert client.delete(f"/api/document/{did}").status_code == 200
    docs = client.get("/api/documents/library").json()["documents"]
    assert all(d["id"] != did for d in docs)


def test_get_unknown_document_404(client):
    assert client.get("/api/document/does-not-exist").status_code == 404

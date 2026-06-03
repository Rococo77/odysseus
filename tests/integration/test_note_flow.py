"""Critical flow: notes CRUD (create → list → get → update → pin → delete).

Exercises routes/note_routes.py through the real app + DB. Doubles as the
regression check for that file's migration to Depends(get_db).
"""

import pytest

pytestmark = pytest.mark.integration


def _create_note(client, title="Note", content="body"):
    r = client.post("/api/notes", json={"title": title, "content": content})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_create_and_list(client):
    nid = _create_note(client, "Listed note")
    r = client.get("/api/notes")
    assert r.status_code == 200
    notes = r.json()["notes"]
    assert any(n["id"] == nid and n["title"] == "Listed note" for n in notes)


def test_get_and_update(client):
    nid = _create_note(client, "Editable", "v1")
    assert client.get(f"/api/notes/{nid}").status_code == 200
    upd = client.put(f"/api/notes/{nid}", json={"content": "v2"})
    assert upd.status_code == 200
    assert upd.json()["content"] == "v2"


def test_pin_then_archive_toggle(client):
    nid = _create_note(client, "Togglable")
    pin = client.post(f"/api/notes/{nid}/pin")
    assert pin.status_code == 200 and pin.json()["pinned"] is True
    arch = client.post(f"/api/notes/{nid}/archive")
    assert arch.status_code == 200 and arch.json()["archived"] is True
    # Archived notes appear under the archived view.
    archived = client.get("/api/notes", params={"archived": "true"}).json()["notes"]
    assert any(n["id"] == nid for n in archived)


def test_delete(client):
    nid = _create_note(client, "Disposable")
    assert client.delete(f"/api/notes/{nid}").status_code == 200
    assert all(n["id"] != nid for n in client.get("/api/notes").json()["notes"])


def test_get_unknown_note_404(client):
    assert client.get("/api/notes/does-not-exist").status_code == 404

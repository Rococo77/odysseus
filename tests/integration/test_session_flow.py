"""Critical flow: session lifecycle (create → list → history → archive → delete).

Exercises routes/session_routes.py end to end through the real app + DB. This
is part of the refactor safety net — the routes refactor must keep these
behaviours intact.
"""

import pytest

pytestmark = pytest.mark.integration


def _create_session(client, name="Flow"):
    r = client.post(
        "/api/session",
        data={
            "endpoint_url": "http://test.local/v1/chat/completions",
            "model": "test-model",
            "skip_validation": "true",
            "name": name,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_create_and_list(client):
    sid = _create_session(client, "Listed")
    r = client.get("/api/sessions")
    assert r.status_code == 200
    sessions = r.json()
    assert isinstance(sessions, list)
    assert any(s.get("id") == sid for s in sessions)


def test_history_starts_empty(client):
    sid = _create_session(client, "History")
    r = client.get(f"/api/history/{sid}")
    assert r.status_code == 200
    body = r.json()
    history = body["history"] if isinstance(body, dict) else body
    assert history == []


def test_archive_then_unarchive(client):
    sid = _create_session(client, "Archive me")
    assert client.post(f"/api/session/{sid}/archive").status_code == 200
    archived = client.get("/api/sessions/archived").json()["sessions"]
    assert any(s.get("id") == sid for s in archived)
    assert client.post(f"/api/session/{sid}/unarchive").status_code == 200


def test_delete(client):
    sid = _create_session(client, "Delete me")
    assert client.delete(f"/api/session/{sid}").status_code == 200
    # Gone from the active list.
    assert all(s.get("id") != sid for s in client.get("/api/sessions").json())


def test_owner_isolation_404s_for_unknown_session(client):
    # A session id that doesn't exist (or isn't owned) must 404, never 200.
    r = client.get("/api/history/does-not-exist")
    assert r.status_code == 404

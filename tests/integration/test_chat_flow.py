"""Critical flow: non-streaming chat (POST /api/chat) with the LLM mocked.

Exercises routes/chat_routes.py: owner check, orphaned-endpoint guard, context
build, the LLM call seam, and message persistence — without any network.
"""

import pytest

pytestmark = pytest.mark.integration


def _make_session(client, seed_endpoint):
    base_url, chat_url, model = seed_endpoint
    r = client.post(
        "/api/session",
        data={
            "endpoint_url": chat_url,
            "model": model,
            "skip_validation": "true",
            "name": "Chat",
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_chat_returns_mocked_reply(client, seed_endpoint, mock_llm):
    sid = _make_session(client, seed_endpoint)
    r = client.post("/api/chat", json={"message": "hello", "session": sid})
    assert r.status_code == 200, r.text
    assert r.json()["response"] == mock_llm


def test_chat_persists_messages(client, seed_endpoint, mock_llm):
    sid = _make_session(client, seed_endpoint)
    # Neutral message — avoid words like "remember" that the memory-command
    # handler intercepts before the LLM call.
    client.post("/api/chat", json={"message": "what is the capital of France", "session": sid})

    body = client.get(f"/api/history/{sid}").json()
    history = body["history"] if isinstance(body, dict) else body
    roles = [m.get("role") for m in history]
    assert "user" in roles and "assistant" in roles
    assert any(mock_llm in (m.get("content") or "") for m in history)


def test_chat_unknown_session_404(client, seed_endpoint, mock_llm):
    r = client.post("/api/chat", json={"message": "hi", "session": "nope"})
    assert r.status_code == 404


def test_chat_rejects_empty_message(client, seed_endpoint, mock_llm):
    sid = _make_session(client, seed_endpoint)
    # ChatRequest enforces min_length=1 → 422 validation error.
    r = client.post("/api/chat", json={"message": "", "session": sid})
    assert r.status_code == 422

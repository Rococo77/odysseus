"""Integration-test harness: a real FastAPI TestClient over the full app.

These tests boot the actual `app` object (all routers wired as in production)
against a throwaway SQLite DB, with auth disabled and external services
(LLM, ChromaDB, IMAP, network) absent — the app degrades gracefully. They are
the safety net for the routes refactor (epic #2, Phase 0): they pin the API
surface and the behaviour of critical flows so the refactor can't silently
change them.

Notes
-----
* Env is set BEFORE importing `app` (module-level side effects read it).
* We use `TestClient(app)` WITHOUT the `with` context manager on purpose: the
  lifespan startup spawns background tasks (MCP stdio servers, email pollers,
  the task scheduler) that are irrelevant here and noisy on shutdown. Routes
  are registered at import time, so requests work without lifespan.
* The repo-root conftest stubs `src.database` with a MagicMock (for unit tests
  that run without SQLAlchemy). Integration tests need the real DB, so we drop
  that stub before importing the app.
"""

import os
import sys
import tempfile
import uuid

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _REPO_ROOT)

# A unique throwaway DB per test session.
_DB_PATH = os.path.join(tempfile.gettempdir(), f"odysseus_inttest_{uuid.uuid4().hex}.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_PATH}")
os.environ.setdefault("AUTH_ENABLED", "false")
os.environ.setdefault("LOCALHOST_BYPASS", "true")

# Undo the repo-root MagicMock stub so the real core.database re-export loads.
sys.modules.pop("src.database", None)


TEST_USER = "tester"


@pytest.fixture(scope="session")
def client():
    """A TestClient over the fully wired app, backed by a fresh SQLite schema.

    Auth is off (no AuthMiddleware), so we inject a fixed authenticated user via
    a tiny test middleware: `get_current_user(request)` reads
    `request.state.current_user` everywhere, so this satisfies both the
    `require_user` dependency and the direct `_verify_session_owner` checks
    without standing up the real cookie/login flow. Rows created in tests are
    therefore owned by TEST_USER.
    """
    from starlette.middleware.base import BaseHTTPMiddleware

    from app import app
    from core.database import Base, engine

    class _InjectUser(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            request.state.current_user = TEST_USER
            request.state.api_token = False
            return await call_next(request)

    app.add_middleware(_InjectUser)
    Base.metadata.create_all(engine)

    from fastapi.testclient import TestClient

    test_client = TestClient(app)
    yield test_client

    try:
        os.remove(_DB_PATH)
    except OSError:
        pass


@pytest.fixture
def mock_llm(monkeypatch):
    """Replace the non-streaming LLM call so /api/chat returns a canned reply
    without any network. Returns the canned text for assertions."""
    canned = "Canned assistant reply for integration tests."

    async def _fake_llm_call_async(*args, **kwargs):
        return canned

    monkeypatch.setattr("routes.chat_routes.llm_call_async", _fake_llm_call_async)
    return canned


@pytest.fixture
def seed_endpoint():
    """Insert an enabled ModelEndpoint so sessions pointing at it aren't treated
    as orphaned. Returns (base_url, chat_url, model)."""
    from core.database import ModelEndpoint, SessionLocal

    base_url = "http://test.local/v1"
    chat_url = base_url + "/chat/completions"
    model = "test-model"

    db = SessionLocal()
    try:
        ep = ModelEndpoint(
            id="int-test-ep",
            name="Integration Test Endpoint",
            base_url=base_url,
            is_enabled=True,
            owner=TEST_USER,
        )
        db.merge(ep)
        db.commit()
    finally:
        db.close()
    return base_url, chat_url, model

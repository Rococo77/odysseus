"""Critical flow: email folder listing with IMAP mocked.

Exercises routes/email_routes.py without any network: the `_imap` context
manager (the single seam every mailbox op goes through) is replaced with a fake
connection. This pins the route's parsing of IMAP LIST responses.
"""

from contextlib import contextmanager

import pytest

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_imap(monkeypatch):
    """Patch routes.email_routes._imap with a fake connection yielding canned
    IMAP LIST output."""

    class _FakeConn:
        def list(self):
            return (
                "OK",
                [
                    b'(\\HasNoChildren) "/" "INBOX"',
                    b'(\\HasNoChildren) "/" "Sent"',
                    b'(\\HasNoChildren) "/" "Drafts"',
                ],
            )

    @contextmanager
    def _fake_imap(account_id=None, owner=None):
        yield _FakeConn()

    monkeypatch.setattr("routes.email_routes._imap", _fake_imap)


def test_list_folders_parses_imap(client, mock_imap):
    r = client.get("/api/email/folders")
    assert r.status_code == 200
    folders = r.json()["folders"]
    assert {"INBOX", "Sent", "Drafts"} <= set(folders)


def test_list_folders_degrades_gracefully(client, monkeypatch):
    """When IMAP raises, the route must not 500 — it returns an empty list."""

    @contextmanager
    def _boom(account_id=None, owner=None):
        raise RuntimeError("imap down")
        yield  # pragma: no cover

    monkeypatch.setattr("routes.email_routes._imap", _boom)
    r = client.get("/api/email/folders")
    assert r.status_code == 200
    assert r.json()["folders"] == []

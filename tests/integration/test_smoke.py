"""Smoke tests: the app boots and its always-available endpoints respond.

If any of these fail, the integration harness itself is broken — fix that
before trusting the contract/flow tests.
"""

import pytest

pytestmark = pytest.mark.integration


def test_openapi_served(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert r.json()["paths"], "OpenAPI schema has no paths"


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_version(client):
    r = client.get("/api/version")
    assert r.status_code == 200
    assert r.json()["version"]


def test_auth_status_unconfigured(client):
    r = client.get("/api/auth/status")
    assert r.status_code == 200
    body = r.json()
    assert "configured" in body and "authenticated" in body

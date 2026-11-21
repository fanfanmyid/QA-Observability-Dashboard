"""API smoke tests for the QA Observability BFF.

Run: pytest backend/tests -v
No external services required — Jenkins/SSH integrations are exercised
in their graceful-degradation paths.
"""
import importlib
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("QA_DASHBOARD_PASSWORD", "test-password")
    monkeypatch.setenv("CRED_TOKEN", "test-token-abc123")
    import main
    importlib.reload(main)
    return TestClient(main.app)


@pytest.fixture()
def auth_headers():
    return {"Authorization": "Bearer test-token-abc123"}


def test_login_success(client):
    res = client.post("/api/login", json={"password": "test-password"})
    assert res.status_code == 200
    assert res.json()["token"] == "test-token-abc123"


def test_login_wrong_password(client):
    res = client.post("/api/login", json={"password": "nope"})
    assert res.status_code == 401


def test_login_fail_closed_when_env_unset(monkeypatch):
    monkeypatch.delenv("QA_DASHBOARD_PASSWORD", raising=False)
    monkeypatch.delenv("CRED_TOKEN", raising=False)
    import main
    importlib.reload(main)
    c = TestClient(main.app)
    # Empty password must NOT authenticate when env is unconfigured
    res = c.post("/api/login", json={"password": ""})
    assert res.status_code == 401


def test_protected_endpoint_requires_token(client):
    res = client.get("/api/qa/pipeline")
    assert res.status_code in (401, 403)


def test_protected_endpoint_rejects_bad_token(client):
    res = client.get("/api/qa/pipeline", headers={"Authorization": "Bearer wrong"})
    assert res.status_code == 401


def test_pipeline_degrades_gracefully(client, auth_headers):
    res = client.get("/api/qa/pipeline", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["backend"]["status"] == "UNKNOWN"
    assert body["frontend"]["status"] == "UNKNOWN"


def test_tests_endpoint_no_fabricated_numbers(client, auth_headers):
    res = client.get("/api/qa/tests", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["backend"]["total"] == 0
    assert body["frontend"]["total"] == 0


def test_health_degrades_gracefully(client, auth_headers):
    res = client.get("/api/qa/health", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["backend"]["status"] == "UNKNOWN"


def test_logs_rejects_unknown_service(client, auth_headers):
    res = client.get("/api/qa/logs?service=evil", headers=auth_headers)
    assert res.status_code == 400


def test_logs_unconfigured_host(client, auth_headers):
    res = client.get("/api/qa/logs?service=backend", headers=auth_headers)
    assert res.status_code == 200
    assert "not configured" in res.json()[0]

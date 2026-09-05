import pytest
from fastapi.testclient import TestClient
from api import app

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data

def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_stats_endpoint(client):
    response = client.get("/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_chunks" in data
    assert "embedding_model" in data
    assert data["status"] == "online"

def test_search_empty_query(client):
    response = client.get("/search?q=")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == ""
    assert data["results"] == []

def test_ingest_empty_input(client):
    response = client.post("/ingest", json={"github_url": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_processed"] == 0
    assert "Please provide" in data["message"]

def test_ingest_invalid_format(client):
    response = client.post("/ingest", json={"github_url": "not-a-valid-github-link"})
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_processed"] == 0
    assert "Invalid GitHub repository URL" in data["message"]

def test_suggestions_endpoint_default(client):
    response = client.get("/suggestions")
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0

def test_suggestions_endpoint_repo(client):
    response = client.get("/suggestions?repo=pallets/flask")
    assert response.status_code == 200
    data = response.json()
    assert data["repository"] == "pallets/flask"
    assert len(data["suggestions"]) == 4
    assert any("Flask" in q for q in data["suggestions"])


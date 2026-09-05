import os
import shutil
import tempfile
import pytest

from extraction.github_puller import extract_markdown_files
from processing.chunker import chunk_markdown
from ingestion.embedder import get_embedding_model
from db.vector_store import ChromaVectorStore
from processing.suggestion_generator import generate_repo_suggestions

@pytest.fixture
def temp_environment():
    """Create temporary directories for mock repo and ChromaDB persistence."""
    temp_dir = tempfile.mkdtemp(prefix="docurag_e2e_")
    mock_repo = os.path.join(temp_dir, "mock_repo")
    os.makedirs(os.path.join(mock_repo, "docs"), exist_ok=True)
    chroma_dir = os.path.join(temp_dir, "chroma_db")

    # Create mock markdown files
    with open(os.path.join(mock_repo, "README.md"), "w", encoding="utf-8") as f:
        f.write("""# QuantumGateway

An ultra-low latency API gateway with neural rate limiting.

## Overview
QuantumGateway handles distributed request routing across microservices.

## Architecture
Built on top of async event loops and lock-free ring buffers.

## Quick Start
Run `pip install quantum-gateway` and execute `qg start`.
""")

    with open(os.path.join(mock_repo, "docs", "authentication.md"), "w", encoding="utf-8") as f:
        f.write("""# Authentication & Security

Learn how to authenticate requests using JSON Web Tokens (JWT) and OAuth2 bearer tokens.

## JWT Bearer Configuration
Clients must include an Authorization header with `Bearer <token>`.
Tokens are cryptographically signed using RS256 private keys.
Expired or malformed tokens will immediately return HTTP 401 Unauthorized.
""")

    with open(os.path.join(mock_repo, "docs", "database.md"), "w", encoding="utf-8") as f:
        f.write("""# Database Connection & Storage

Configuring PostgreSQL connection pooling and SQL migrations.

## PostgreSQL Connection Pooling
We recommend sizing your pool between 10 and 20 connections per worker thread.
Use asyncpg driver for non-blocking I/O operations and automatic retry on connection drops.
""")

    # Set custom persist directory for isolated testing
    old_env = os.environ.get("CHROMA_PERSIST_DIRECTORY")
    os.environ["CHROMA_PERSIST_DIRECTORY"] = chroma_dir

    yield {
        "temp_dir": temp_dir,
        "mock_repo": mock_repo,
        "chroma_dir": chroma_dir
    }

    # Teardown
    if old_env is not None:
        os.environ["CHROMA_PERSIST_DIRECTORY"] = old_env
    else:
        os.environ.pop("CHROMA_PERSIST_DIRECTORY", None)

    shutil.rmtree(temp_dir, ignore_errors=True)


def test_full_pipeline_end_to_end(temp_environment):
    mock_repo = temp_environment["mock_repo"]

    # 1. Extraction
    docs = list(extract_markdown_files(mock_repo))
    assert len(docs) == 3
    sources = [d.get("filepath") or d.get("source") for d in docs]
    assert any("README.md" in s for s in sources)
    assert any("authentication.md" in s for s in sources)
    assert any("database.md" in s for s in sources)

    # 2. Chunking & Text Cleaning
    chunks = chunk_markdown(docs, chunk_size=500, chunk_overlap=50)
    assert len(chunks) >= 3
    for chunk in chunks:
        assert "text" in chunk
        assert "metadata" in chunk
        assert "source" in chunk["metadata"]
        assert len(chunk["text"]) >= 20

    # 3. Dynamic Question Generation
    suggestions = generate_repo_suggestions(docs, "QuantumGateway")
    assert len(suggestions) == 4
    # Headings like Authentication, Quick Start, Overview, Architecture should generate questions
    assert any("QuantumGateway" in q for q in suggestions)

    # 4. Neural Embeddings
    embedder = get_embedding_model()
    texts = [chunk["text"] for chunk in chunks]
    embeddings = embedder.embed_documents(texts)
    assert len(embeddings) == len(chunks)
    assert len(embeddings[0]) == 384

    # 5. ChromaDB Upsert
    vector_store = ChromaVectorStore()
    vector_store.upsert_chunks(chunks, embeddings, "QuantumGateway")

    stats = vector_store.get_stats()
    assert stats["total_chunks"] == len(chunks)
    assert "QuantumGateway" in stats["repositories"]

    # 6. Semantic Search Accuracy
    # Query A: Authentication
    auth_query = "How to authenticate with JWT bearer tokens?"
    auth_vec = embedder.embed_query(auth_query)
    auth_results = vector_store.search(auth_vec, n_results=3)

    assert len(auth_results["documents"][0]) > 0
    top_auth_meta = auth_results["metadatas"][0][0]
    assert "authentication.md" in top_auth_meta["source"]
    assert "JWT" in auth_results["documents"][0][0]

    # Query B: Database
    db_query = "How to configure PostgreSQL connection pool?"
    db_vec = embedder.embed_query(db_query)
    db_results = vector_store.search(db_vec, n_results=3)

    assert len(db_results["documents"][0]) > 0
    top_db_meta = db_results["metadatas"][0][0]
    assert "database.md" in top_db_meta["source"]
    assert "PostgreSQL" in db_results["documents"][0][0]

    # 7. Multi-Repo Filtering
    second_chunk = [{
        "text": "Microservice logger with structured JSON output.",
        "metadata": {"source": "logger.md", "chunk_index": 0}
    }]
    second_emb = embedder.embed_documents(["Microservice logger with structured JSON output."])
    vector_store.upsert_chunks(second_chunk, second_emb, "LoggerEngine")

    # Search with filter for LoggerEngine
    logger_results = vector_store.search(db_vec, n_results=5, repo_filter="LoggerEngine")
    assert len(logger_results["documents"][0]) == 1
    assert logger_results["metadatas"][0][0]["repository"] == "LoggerEngine"

    # Search with filter for QuantumGateway
    qg_results = vector_store.search(db_vec, n_results=5, repo_filter="QuantumGateway")
    assert all(m["repository"] == "QuantumGateway" for m in qg_results["metadatas"][0])

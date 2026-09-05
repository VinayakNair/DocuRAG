import tempfile
import pytest
from db.vector_store import ChromaVectorStore

@pytest.fixture
def temp_vector_store():
    with tempfile.TemporaryDirectory() as temp_dir:
        store = ChromaVectorStore(persist_directory=temp_dir, collection_name="test_docs")
        yield store

def test_empty_search(temp_vector_store):
    res = temp_vector_store.search([0.0] * 384, n_results=5)
    assert res["documents"] == [[]]
    assert res["ids"] == [[]]

def test_upsert_and_search(temp_vector_store):
    chunks = [
        {"text": "FastAPI is a fast web framework.", "metadata": {"source": "fastapi.md", "chunk_index": 0}},
        {"text": "Flask is a lightweight WSGI framework.", "metadata": {"source": "flask.md", "chunk_index": 0}}
    ]
    # Synthetic 384-dim unit-ish vectors
    vec1 = [0.5] * 192 + [0.0] * 192
    vec2 = [0.0] * 192 + [0.5] * 192
    embeddings = [vec1, vec2]

    temp_vector_store.upsert_chunks(chunks, embeddings, "web_frameworks")

    stats = temp_vector_store.get_stats()
    assert stats["total_chunks"] == 2
    assert "web_frameworks" in stats["repositories"]

    # Search with vec1: nearest should be FastAPI
    results = temp_vector_store.search(vec1, n_results=1)
    assert len(results["documents"][0]) == 1
    assert "FastAPI" in results["documents"][0][0]

def test_repo_filter(temp_vector_store):
    chunks_a = [{"text": "Doc A content", "metadata": {"source": "a.md", "chunk_index": 0}}]
    chunks_b = [{"text": "Doc B content", "metadata": {"source": "b.md", "chunk_index": 0}}]
    vec_a = [0.1] * 384
    vec_b = [0.2] * 384

    temp_vector_store.upsert_chunks(chunks_a, [vec_a], "repo_alpha")
    temp_vector_store.upsert_chunks(chunks_b, [vec_b], "repo_beta")

    res = temp_vector_store.search(vec_a, n_results=2, repo_filter="repo_beta")
    assert len(res["documents"][0]) == 1
    assert "Doc B" in res["documents"][0][0]

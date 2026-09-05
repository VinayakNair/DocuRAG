import pytest
from ingestion.embedder import get_embedding_model

def test_embedder_caching():
    """Verify that get_embedding_model returns the cached singleton instance."""
    model_1 = get_embedding_model()
    model_2 = get_embedding_model()
    assert model_1 is model_2, "get_embedding_model must return cached instance via @lru_cache"

def test_embed_query_dimensions():
    """Verify that query embedding produces a 384-dimensional dense float vector."""
    model = get_embedding_model()
    vector = model.embed_query("How does semantic vector search work?")
    assert isinstance(vector, list)
    assert len(vector) == 384
    assert all(isinstance(val, float) for val in vector)

def test_embed_documents_batch():
    """Verify that batch document embedding returns correct dimension for each text."""
    model = get_embedding_model()
    texts = [
        "FastAPI is a modern, fast web framework for building APIs with Python.",
        "ChromaDB is the AI-native open-source embedding database.",
        "LangChain provides tools for document loading, splitting, and chunking."
    ]
    vectors = model.embed_documents(texts)
    assert len(vectors) == 3
    for vec in vectors:
        assert len(vec) == 384
        assert all(isinstance(val, float) for val in vec)

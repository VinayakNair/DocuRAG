import pytest
from processing.chunker import chunk_markdown

def test_chunk_markdown_empty():
    assert chunk_markdown([]) == []

def test_chunk_markdown_single_doc():
    doc = {
        "filepath": "docs/quickstart.md",
        "content": (
            "# Quickstart Guide\n\n"
            "This guide walks you through setting up the DocuRAG service.\n\n"
            "Follow these steps carefully to ensure a smooth installation."
        )
    }
    chunks = chunk_markdown([doc], chunk_size=100, chunk_overlap=20)
    assert len(chunks) > 0
    for chunk in chunks:
        assert "text" in chunk
        assert "metadata" in chunk
        assert chunk["metadata"]["source"] == "docs/quickstart.md"
        assert isinstance(chunk["metadata"]["chunk_index"], int)

def test_chunk_overlap_safety():
    doc = {
        "filepath": "README.md",
        "content": "This is a sample document for testing invalid chunk parameters."
    }
    # chunk_overlap (200) > chunk_size (100) should be clamped safely without raising an exception
    chunks = chunk_markdown([doc], chunk_size=100, chunk_overlap=200)
    assert isinstance(chunks, list)

def test_short_docs_retention():
    doc = {
        "filepath": "short.md",
        "content": "A concise overview of our application API and services."
    }
    chunks = chunk_markdown([doc], chunk_size=500, chunk_overlap=50)
    assert len(chunks) == 1
    assert "A concise overview" in chunks[0]["text"]

from unittest.mock import patch, MagicMock
from main import search_pipeline, run_pipeline

def test_search_pipeline_with_results(capsys):
    """Test search_pipeline prints formatted results when documents are found."""
    mock_vector_store = MagicMock()
    mock_vector_store.search.return_value = {
        "documents": [["FastAPI dependency injection is declared using Depends()"]],
        "metadatas": [[{"source": "docs/dependencies.md", "chunk_index": 1}]]
    }

    mock_embedder = MagicMock()
    mock_embedder.embed_query.return_value = [0.1] * 384

    with patch("main.get_embedding_model", return_value=mock_embedder), \
         patch("main.ChromaVectorStore", return_value=mock_vector_store):
        search_pipeline("How to use Depends?")

    captured = capsys.readouterr()
    assert "FastAPI dependency injection" in captured.out
    assert "docs/dependencies.md" in captured.out


def test_search_pipeline_empty_results(capsys):
    """Test search_pipeline prints empty notice when no documents match."""
    mock_vector_store = MagicMock()
    mock_vector_store.search.return_value = {"documents": [[]], "metadatas": [[]]}

    mock_embedder = MagicMock()
    mock_embedder.embed_query.return_value = [0.1] * 384

    with patch("main.get_embedding_model", return_value=mock_embedder), \
         patch("main.ChromaVectorStore", return_value=mock_vector_store):
        search_pipeline("Unknown query")

    captured = capsys.readouterr()
    assert "No matching documents found." in captured.out


def test_run_pipeline_success(capsys):
    """Test run_pipeline completes successfully with mocked download and ChromaDB."""
    mock_embedder = MagicMock()
    mock_embedder.embed_documents.return_value = [[0.1] * 384]

    mock_vector_store = MagicMock()

    with patch("main.download_github_repo", return_value="/tmp/mock_repo"), \
         patch("main.extract_markdown_files", return_value=[{"source": "README.md", "content": "# Test"}]), \
         patch("main.chunk_markdown", return_value=[{"text": "Sample chunk", "source": "README.md"}]), \
         patch("main.get_embedding_model", return_value=mock_embedder), \
         patch("main.ChromaVectorStore", return_value=mock_vector_store), \
         patch("os.path.exists", return_value=True), \
         patch("shutil.rmtree") as mock_rm:
        run_pipeline()

    captured = capsys.readouterr()
    assert "Starting pipeline for" in captured.out
    assert "Pipeline complete for" in captured.out
    assert mock_vector_store.upsert_chunks.called

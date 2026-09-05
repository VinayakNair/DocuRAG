import os
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db.vector_store import ChromaVectorStore
from ingestion.embedder import get_embedding_model
from extraction.github_puller import download_github_repo, extract_markdown_files, normalize_github_url
from processing.chunker import chunk_markdown
from processing.suggestion_generator import generate_repo_suggestions

app = FastAPI(
    title="DocuRAG Search API",
    description="High-performance local semantic documentation search engine powered by LangChain and ChromaDB",
    version="1.1.0"
)

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    version: str
    message: str

@app.get("/", response_model=HealthResponse)
@app.get("/health", response_model=HealthResponse)
def health_check():
    """
    Health check endpoint for Render/Vercel and local monitoring.
    """
    return {
        "status": "ok",
        "version": "1.1.0",
        "message": "DocuRAG API is operational."
    }

@app.get("/stats")
def get_stats():
    """
    Returns statistics about indexed chunks and repositories.
    """
    vector_store = ChromaVectorStore()
    stats = vector_store.get_stats()
    stats["embedding_model"] = "all-MiniLM-L6-v2"
    stats["status"] = "online"
    return stats

class SearchResponse(BaseModel):
    query: str
    results: List[Dict[str, Any]]
    total_found: int = 0

@app.get("/search", response_model=SearchResponse)
def search_docs(
    q: str = Query("", description="Natural language search query"),
    n_results: int = Query(5, ge=1, le=50, description="Number of results to retrieve"),
    repo: Optional[str] = Query(None, description="Optional repository name filter")
):
    """
    Search the Chroma vector store using dense sentence embeddings.
    """
    query_str = q.strip()
    if not query_str:
        return {"query": "", "results": [], "total_found": 0}

    # Get cached embedding model and compute query embedding
    embedder = get_embedding_model()
    query_embedding = embedder.embed_query(query_str)

    # Search Chroma DB
    vector_store = ChromaVectorStore()
    docs = vector_store.search(query_embedding, n_results=n_results, repo_filter=repo)

    # Format structured output
    structured_results = []
    if docs and 'documents' in docs and len(docs['documents']) > 0 and len(docs['documents'][0]) > 0:
        for i, text in enumerate(docs['documents'][0]):
            meta = docs['metadatas'][0][i] if 'metadatas' in docs and len(docs['metadatas'][0]) > i else {}
            structured_results.append({
                "text": text,
                "source": meta.get('source', 'Unknown'),
                "chunk_index": meta.get('chunk_index', 0),
                "repository": meta.get('repository', 'Unknown')
            })

    return {
        "query": query_str,
        "results": structured_results,
        "total_found": len(structured_results)
    }

class IngestRequest(BaseModel):
    github_url: str

class IngestResponse(BaseModel):
    message: str
    chunks_processed: int
    repository: Optional[str] = None
    suggested_queries: List[str] = []

@app.get("/suggestions")
def get_repo_suggestions(repo: Optional[str] = Query(None, description="Repository name")):
    """
    Return relevant questions and suggestions for a repository.
    """
    repo_key = (repo or "").strip()
    if repo_key:
        suggestions = generate_repo_suggestions([], repo_key)
        return {
            "repository": repo_key,
            "suggestions": suggestions
        }

    return {
        "repository": "tiangolo/fastapi",
        "suggestions": [
            "How does dependency injection work in FastAPI?",
            "How to configure CORS middleware safely?",
            "How to handle background tasks and worker threads?",
            "How to define path parameters with Pydantic validation?"
        ]
    }

@app.post("/ingest", response_model=IngestResponse)
def ingest_repo(req: IngestRequest):
    """
    Ingest any public GitHub repository on the fly.
    Accepts full URLs (https://github.com/owner/repo) or shorthands (owner/repo).
    """
    raw_input = req.github_url.strip()
    if not raw_input:
        return {"message": "Please provide a GitHub repository URL or shorthand.", "chunks_processed": 0, "suggested_queries": []}

    try:
        canonical_url, repo_name = normalize_github_url(raw_input)
    except ValueError as err:
        return {"message": str(err), "chunks_processed": 0, "suggested_queries": []}

    repo_path = None
    try:
        repo_path = download_github_repo(canonical_url)
        docs = list(extract_markdown_files(repo_path))
        if not docs:
            return {
                "message": f"No markdown (.md, .mdx) documentation files found in {repo_name}.",
                "chunks_processed": 0,
                "repository": repo_name,
                "suggested_queries": []
            }

        # Generate smart suggestions based on extracted docs and repo topics
        suggested_queries = generate_repo_suggestions(docs, repo_name)

        chunks = chunk_markdown(docs, chunk_size=1000, chunk_overlap=100)
        if not chunks:
            return {
                "message": f"Documentation files in {repo_name} were too short to produce chunks.",
                "chunks_processed": 0,
                "repository": repo_name,
                "suggested_queries": []
            }

        # Cap at 100 chunks for quick CPU execution
        if len(chunks) > 100:
            chunks = chunks[:100]

        embedder = get_embedding_model()
        texts = [chunk['text'] for chunk in chunks]
        embeddings = embedder.embed_documents(texts)

        vector_store = ChromaVectorStore()
        vector_store.upsert_chunks(chunks, embeddings, repo_name)

        return {
            "message": f"Successfully ingested {len(chunks)} chunks from {repo_name}.",
            "chunks_processed": len(chunks),
            "repository": repo_name,
            "suggested_queries": suggested_queries
        }
    except Exception as e:
        return {
            "message": f"Failed to ingest {repo_name}: {str(e)}",
            "chunks_processed": 0,
            "repository": repo_name,
            "suggested_queries": []
        }
    finally:
        if repo_path and os.path.exists(repo_path):
            # Clean up repo directory and enclosing temp directory if applicable
            parent_temp = os.path.dirname(repo_path)
            shutil.rmtree(repo_path, ignore_errors=True)
            if parent_temp and os.path.basename(parent_temp).startswith("tmp"):
                shutil.rmtree(parent_temp, ignore_errors=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)


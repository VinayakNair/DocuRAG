from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from db.vector_store import ChromaVectorStore
from ingestion.embedder import get_embedding_model
import shutil
from extraction.github_puller import download_github_repo, extract_markdown_files
from processing.chunker import chunk_markdown

app = FastAPI(title="DocuRAG Search API", description="API for retrieving semantic documentation chunks")

# Allow CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only. Setup correct origin in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchResponse(BaseModel):
    query: str
    results: List[Dict[str, Any]]

@app.get("/search", response_model=SearchResponse)
def search_docs(q: str, n_results: int = 5):
    """
    Search the chroma vector store for the query.
    """
    if not q:
        return {"query": "", "results": []}
        
    # Get embedding for the query
    embedder = get_embedding_model()
    query_embedding = embedder.embed_query(q)
    
    # Search DB
    vector_store = ChromaVectorStore()
    docs = vector_store.search(query_embedding, n_results=n_results)
    
    # Format output
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
            
    return {"query": q, "results": structured_results}

class IngestRequest(BaseModel):
    github_url: str

class IngestResponse(BaseModel):
    message: str
    chunks_processed: int

@app.post("/ingest", response_model=IngestResponse)
def ingest_repo(req: IngestRequest):
    """
    Ingest a GitHub repository on the fly.
    """
    repo_url = req.github_url
    if "github.com" not in repo_url:
        return {"message": "Invalid GitHub URL.", "chunks_processed": 0}
        
    repo_name = repo_url.strip("/").split("/")[-1]
    
    try:
        repo_path = download_github_repo(repo_url)
    except Exception as e:
        return {"message": f"Failed to download: {str(e)}", "chunks_processed": 0}
        
    docs = list(extract_markdown_files(repo_path))
    if not docs:
        shutil.rmtree(repo_path, ignore_errors=True)
        return {"message": "No markdown files found.", "chunks_processed": 0}
         
    chunks = chunk_markdown(docs, chunk_size=1000, chunk_overlap=100)
    
    # Cap at 100 for local CPU speed
    if len(chunks) > 100:
        chunks = chunks[:100]
        
    embedder = get_embedding_model()
    texts = [chunk['text'] for chunk in chunks]
    embeddings = embedder.embed_documents(texts)
    
    vector_store = ChromaVectorStore()
    vector_store.upsert_chunks(chunks, embeddings, repo_name)
    
    shutil.rmtree(repo_path, ignore_errors=True)
    return {"message": f"Successfully ingested ({len(chunks)} chunks).", "chunks_processed": len(chunks)}

if __name__ == "__main__":
    import uvicorn
    # Make sure to run the app via uvicorn if executing this file directly
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

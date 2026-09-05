import os
import shutil
import sys
from extraction.github_puller import download_github_repo, extract_markdown_files
from processing.chunker import chunk_markdown
from ingestion.embedder import get_embedding_model
from db.vector_store import ChromaVectorStore

# Configure test repo
TEST_REPO = "https://github.com/tiangolo/fastapi"
REPO_NAME = "fastapi"

def run_pipeline():
    print(f"Starting pipeline for {TEST_REPO}")
    repo_path = None
    try:
        # 1. Extraction
        repo_path = download_github_repo(TEST_REPO)
        print(f"Downloaded and extracted to {repo_path}")
        
        docs = list(extract_markdown_files(repo_path))
        print(f"Found {len(docs)} markdown files.")
        
        # 2. Processing
        print("Chunking documents...")
        chunks = chunk_markdown(docs, chunk_size=1000, chunk_overlap=100)
        print(f"Created {len(chunks)} chunks.")
        
        if len(chunks) > 100:
            print("Limiting to 100 chunks for quick testing on CPU. Adjust in production.")
            chunks = chunks[:100]
        
        # 3. Ingestion
        print("Initializing embedding model...")
        embedder = get_embedding_model()
        
        print("Generating embeddings... this may take a moment.")
        texts = [chunk['text'] for chunk in chunks]
        embeddings = embedder.embed_documents(texts)
        print(f"Generated {len(embeddings)} embeddings.")
        
        # 4. Vector Store DB
        print("Connecting to ChromaDB and upserting...")
        vector_store = ChromaVectorStore()
        vector_store.upsert_chunks(chunks, embeddings, REPO_NAME)
        print(f"Pipeline complete for {TEST_REPO}!")
    finally:
        # Cleanup
        if repo_path and os.path.exists(repo_path):
            parent_temp = os.path.dirname(repo_path)
            shutil.rmtree(repo_path, ignore_errors=True)
            if parent_temp and os.path.basename(parent_temp).startswith("tmp"):
                shutil.rmtree(parent_temp, ignore_errors=True)

def search_pipeline(query: str):
    print(f"\nSearching for: '{query}'")
    embedder = get_embedding_model()
    query_embedding = embedder.embed_query(query)
    
    vector_store = ChromaVectorStore()
    results = vector_store.search(query_embedding, n_results=3)
    
    if not results or not results.get('documents') or not results['documents'][0]:
        print("No matching documents found.")
        return

    for i, doc in enumerate(results['documents'][0]):
        meta = results['metadatas'][0][i] if 'metadatas' in results and len(results['metadatas'][0]) > i else {}
        source = meta.get('source', 'Unknown')
        chunk_idx = meta.get('chunk_index', 0)
        print(f"\n--- Result {i+1} (Source: {source}, Index: {chunk_idx}) ---")
        print(doc[:300] + "..." if len(doc) > 300 else doc)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "search":
        query = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "How to deploy my app?"
        search_pipeline(query)
    else:
        run_pipeline()
        print("\nTest search query...")
        search_pipeline("How to use dependency injection in FastAPI")

import os
import chromadb
from typing import List, Dict, Optional, Any

class ChromaVectorStore:
    def __init__(self, persist_directory: Optional[str] = None, collection_name: str = "docs"):
        """
        Initializes a connection to a local persistent ChromaDB.
        """
        if persist_directory is None:
            persist_directory = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")

        self.persist_directory = persist_directory
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(name=collection_name)
    
    def upsert_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]], repo_name: str):
        """
        Upserts text chunks and their corresponding embeddings into ChromaDB.
        """
        if not chunks:
            print("No chunks to upsert.")
            return

        if len(chunks) != len(embeddings):
            raise ValueError(f"Mismatch: {len(chunks)} chunks provided but got {len(embeddings)} embeddings.")

        ids = []
        documents = []
        metadatas = []
        
        for chunk in chunks:
            # Create a unique ID for each chunk based on repo, source file, and chunk index
            safe_source = chunk['metadata'].get('source', 'unknown').replace('/', '_').replace('\\', '_')
            chunk_idx = chunk['metadata'].get('chunk_index', 0)
            chunk_id = f"{repo_name}_{safe_source}_{chunk_idx}"
            
            # Enrich metadata with repo_name
            meta = chunk['metadata'].copy()
            meta['repository'] = repo_name
            
            ids.append(chunk_id)
            documents.append(chunk['text'])
            metadatas.append(meta)
            
        self.collection.upsert(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Upserted {len(chunks)} chunks for {repo_name} into ChromaDB")

    def search(self, query_embedding: List[float], n_results: int = 5, repo_filter: Optional[str] = None):
        """
        Searches the database using a given query embedding.
        Returns the closest matching chunks and their metadata.
        """
        total_docs = self.collection.count()
        if total_docs == 0:
            return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

        clamped_n = max(1, min(n_results, total_docs))
        query_kwargs = {
            "query_embeddings": [query_embedding],
            "n_results": clamped_n
        }

        if repo_filter:
            query_kwargs["where"] = {"repository": repo_filter}

        try:
            return self.collection.query(**query_kwargs)
        except Exception:
            # Fallback without where clause if filter matches nothing
            return self.collection.query(query_embeddings=[query_embedding], n_results=clamped_n)

    def get_stats(self) -> Dict[str, Any]:
        """
        Returns summary statistics for the vector database.
        """
        count = self.collection.count()
        repos = set()
        if count > 0:
            try:
                # Sample up to 100 metadata items to identify repositories
                peek_data = self.collection.peek(limit=min(count, 100))
                if peek_data and 'metadatas' in peek_data and peek_data['metadatas']:
                    for meta in peek_data['metadatas']:
                        if meta and 'repository' in meta:
                            repos.add(meta['repository'])
            except Exception:
                pass
        return {
            "total_chunks": count,
            "repositories": sorted(list(repos)),
            "persist_directory": self.persist_directory
        }


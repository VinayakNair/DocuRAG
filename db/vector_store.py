import os
import chromadb
from typing import List, Dict

class ChromaVectorStore:
    def __init__(self, persist_directory: str = "./chroma_db", collection_name: str = "docs"):
        """
        Initializes a connection to a local persistent ChromaDB.
        """
        self.persist_directory = persist_directory
        # The persistent client automatically persists data to the specified path
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(name=collection_name)
    
    def upsert_chunks(self, chunks: List[Dict[str, str]], embeddings: List[List[float]], repo_name: str):
        """
        Upserts text chunks and their corresponding embeddings into ChromaDB.
        """
        if not chunks:
            print("No chunks to upsert.")
            return

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

    def search(self, query_embedding: List[float], n_results: int = 5):
        """
        Searches the database using a given query embedding.
        Returns the closest matching chunks and their metadata.
        """
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        return results

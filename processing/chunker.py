from typing import List, Dict
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .text_cleaner import clean_markdown

def chunk_markdown(documents: List[Dict[str, str]], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Dict[str, str]]:
    """
    Takes a list of document dicts (with 'filepath' and 'content'),
    cleans the content, and chunks it.
    Returns a list of chunk dicts containing 'text' and 'metadata'.
    """
    if not documents:
        return []

    # Safeguard against invalid overlap parameters
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(0, chunk_size // 5)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    chunks = []
    
    for doc in documents:
        filepath = doc.get('filepath', '')
        raw_content = doc.get('content', '')
        
        # Clean the text first
        cleaned_content = clean_markdown(raw_content)
        if not cleaned_content:
            continue
            
        # Split text
        doc_chunks = splitter.split_text(cleaned_content)
        
        for i, chunk_text in enumerate(doc_chunks):
            # Keep chunks with meaningful text content
            if len(chunk_text.strip()) >= 20:
                chunks.append({
                    "text": chunk_text,
                    "metadata": {
                        "source": filepath,
                        "chunk_index": i
                    }
                })
                
    return chunks

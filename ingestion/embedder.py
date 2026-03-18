from langchain_huggingface import HuggingFaceEmbeddings

def get_embedding_model(model_name: str = "all-MiniLM-L6-v2"):
    """
    Returns a HuggingFaceEmbeddings model initialized with the given model name.
    Useful for local CPU-based embedding calculation.
    """
    return HuggingFaceEmbeddings(model_name=model_name)

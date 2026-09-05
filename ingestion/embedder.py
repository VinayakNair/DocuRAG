from functools import lru_cache
from langchain_huggingface import HuggingFaceEmbeddings

@lru_cache(maxsize=4)
def get_embedding_model(model_name: str = "all-MiniLM-L6-v2"):
    """
    Returns a cached HuggingFaceEmbeddings model initialized with the given model name.
    Useful for local CPU-based embedding calculation. Model weights are cached in
    memory so repeated calls/queries avoid expensive disk and neural net initializations.
    """
    return HuggingFaceEmbeddings(model_name=model_name)


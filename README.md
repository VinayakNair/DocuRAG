# DocuRAG

DocuRAG is a local, full-stack Retrieval-Augmented Generation (RAG) pipeline designed to extract, process, and search through complex technical documentation dynamically downloaded from any open-source GitHub repository.

## Features

- **Dynamic GitHub Ingestion**: Input any public GitHub repository URL directly from the sleek UI, and the backend will automatically clone it, extract all `.md`/`.mdx` files, and clean the text of HTML jargon.
- **Local Dense Embeddings**: Generates powerful semantic embeddings locally using the HuggingFace `all-MiniLM-L6-v2` `sentence-transformers` model—100% free with no API keys required.
- **Persistent Vector Storage**: Leverages ChromaDB for blazing-fast semantic similarity search and storage on your local disk.
- **Animated User Interface**: Features a premium, state-of-the-art React + Vite glassmorphism frontend that provides real-time animated pipeline state tracking when ingesting repositories and displays semantic search results in an intuitive layout.

## Project Architecture

1. **Extraction/Processing Engine**: Custom Python extractors and LangChain `RecursiveCharacterTextSplitter` chunkers to curate pristine data (`extraction/`, `processing/`).
2. **Backend API**: A blazing-fast FastAPI backend (`api.py`) exposing the `/search` and `/ingest` endpoints hooking into ChromaDB (`db/`).
3. **Frontend SPA**: A modern React project (`frontend/`) heavily styled with native CSS for maximum UI flexibility.

## Getting Started

### Prerequisites

Ensure you have Python 3.9+ and Node.js installed. Note: The embedding pipeline currently uses CPU and may take 10-30 seconds to ingest a moderate sized repository locally.

### 1. Backend Setup

Open a terminal at the root of the project to initialize the python environment:

```bash
# Initialize and enter virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install required packages
pip install -r requirements.txt

# Start the FastAPI web server
python api.py
```
The FastAPI server will boot up with hot-reloading at `http://localhost:8000`.

### 2. Frontend Setup

Open a second terminal window, navigate to the frontend directory, and start the React dev server:

```bash
cd frontend
npm install
npm run dev
```
The frontend UI will boot up at `http://localhost:5173`. Open it in your browser, paste a URL like `https://github.com/tiangolo/fastapi`, click *Ingest*, and start searching!

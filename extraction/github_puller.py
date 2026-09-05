import os
import re
import shutil
import requests
import tempfile
import zipfile
from pathlib import Path
from typing import Tuple, Generator, Dict

EXCLUDED_DIR_NAMES = {
    "node_modules",
    ".git",
    "venv",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    ".tox",
    ".cache"
}

def normalize_github_url(repo_input: str) -> Tuple[str, str]:
    """
    Normalizes a GitHub repository URL or shorthand (e.g. 'tiangolo/fastapi')
    into a canonical URL (https://github.com/owner/repo) and returns (url, repo_name).
    """
    cleaned = repo_input.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]

    # Remove protocol if present for uniform parsing
    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        without_proto = cleaned.split("://", 1)[1]
    else:
        without_proto = cleaned

    parts = [p for p in without_proto.split("/") if p]

    if len(parts) >= 3 and parts[0] == "github.com":
        owner, repo = parts[1], parts[2]
    elif len(parts) == 2 and parts[0] != "github.com":
        owner, repo = parts[0], parts[1]
    elif "github.com" in without_proto:
        # Match pattern github.com/owner/repo
        match = re.search(r"github\.com[/:]([^/]+)/([^/]+)", cleaned)
        if match:
            owner, repo = match.group(1), match.group(2)
        else:
            raise ValueError(f"Invalid GitHub repository URL: {repo_input}")
    else:
        raise ValueError(
            f"Invalid GitHub repository URL: '{repo_input}'. "
            "Expected 'owner/repo' or 'https://github.com/owner/repo'"
        )

    canonical_url = f"https://github.com/{owner}/{repo}"
    return canonical_url, repo

def download_github_repo(repo_url: str) -> str:
    """
    Downloads a GitHub repository as a zip file and extracts it to a temporary directory.
    Returns the path to the extracted directory.
    Handles 'owner/repo' shortcuts, main/master/HEAD branches, and automatically cleans up zip files.
    """
    canonical_url, repo = normalize_github_url(repo_url)
    parts = canonical_url.split("/")
    owner = parts[-2]

    # Candidate zip branches
    candidate_urls = [
        f"https://github.com/{owner}/{repo}/archive/refs/heads/main.zip",
        f"https://github.com/{owner}/{repo}/archive/refs/heads/master.zip",
        f"https://github.com/{owner}/{repo}/archive/HEAD.zip",
    ]

    response = None
    last_error = None
    last_status = None

    for zip_url in candidate_urls:
        try:
            resp = requests.get(zip_url, stream=True, timeout=30)
            last_status = resp.status_code
            if resp.status_code == 200:
                response = resp
                break
        except requests.RequestException as exc:
            last_error = str(exc)
            continue

    if response is None or response.status_code != 200:
        if last_status == 404:
            raise ValueError(
                f"Repository not found or private at {canonical_url}. "
                "Please check that the repository is public and the spelling is correct."
            )
        elif last_error:
            raise ValueError(f"Network error downloading repository: {last_error}")
        else:
            raise ValueError(f"Unable to download repository from {canonical_url} (HTTP {last_status}).")

    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "repo.zip")

    try:
        with open(zip_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # Extract
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        # Delete zip immediately to save space
        if os.path.exists(zip_path):
            os.remove(zip_path)

        # The extraction creates a folder like 'repo-main', we find it
        extracted_folders = [
            f for f in os.listdir(temp_dir)
            if os.path.isdir(os.path.join(temp_dir, f))
        ]
        if extracted_folders:
            return os.path.join(temp_dir, extracted_folders[0])
        return temp_dir
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise e

def extract_markdown_files(directory_path: str) -> Generator[Dict[str, str], None, None]:
    """
    Traverses the directory and yields content of all .md and .mdx files,
    excluding dependency and hidden folders like node_modules or .git.
    """
    path = Path(directory_path)
    for ext in ["**/*.md", "**/*.mdx"]:
        for file_path in path.glob(ext):
            # Check if any parent directory is in EXCLUDED_DIR_NAMES
            if any(part in EXCLUDED_DIR_NAMES for part in file_path.parts):
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                yield {
                    "filepath": str(file_path.relative_to(path)),
                    "content": content
                }
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")

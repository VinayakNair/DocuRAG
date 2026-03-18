import os
import requests
import tempfile
import zipfile
from pathlib import Path

def download_github_repo(repo_url: str) -> str:
    """
    Downloads a Github repository as a zip file and extracts it to a temporary directory.
    Returns the path to the extracted directory.
    Assumes standard Github layout (e.g. https://github.com/owner/repo)
    """
    if "github.com" not in repo_url:
        raise ValueError("URL must be a github.com repository")

    # Convert to API download url or zipball url
    # e.g. https://github.com/owner/repo/archive/refs/heads/main.zip
    parts = repo_url.strip("/").split("/")
    owner = parts[-2]
    repo = parts[-1]
    
    zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/main.zip"
    
    print(f"Downloading {repo_url} from {zip_url}...")
    response = requests.get(zip_url, stream=True)
    
    # Fallback to master branch if main is not found
    if response.status_code == 404:
        zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/master.zip"
        print(f"Main branch not found, falling back to master branch: {zip_url}")
        response = requests.get(zip_url, stream=True)
    
    response.raise_for_status()
    
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "repo.zip")
    
    with open(zip_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            
    # Extract
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        
    # The extraction creates a folder like 'repo-main', we find it
    extracted_folders = [f for f in os.listdir(temp_dir) if os.path.isdir(os.path.join(temp_dir, f))]
    if extracted_folders:
        return os.path.join(temp_dir, extracted_folders[0])
    return temp_dir

def extract_markdown_files(directory_path: str):
    """
    Traverses the directory and yields content of all .md and .mdx files.
    """
    path = Path(directory_path)
    for ext in ["**/*.md", "**/*.mdx"]:
        for file_path in path.glob(ext):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                yield {
                    "filepath": str(file_path.relative_to(path)),
                    "content": content
                }
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")

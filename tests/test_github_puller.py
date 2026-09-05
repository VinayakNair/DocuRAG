import os
import tempfile
import pytest
from extraction.github_puller import normalize_github_url, extract_markdown_files

def test_normalize_github_url_shorthand():
    url, repo = normalize_github_url("tiangolo/fastapi")
    assert url == "https://github.com/tiangolo/fastapi"
    assert repo == "fastapi"

def test_normalize_github_url_full_https():
    url, repo = normalize_github_url("https://github.com/pallets/flask")
    assert url == "https://github.com/pallets/flask"
    assert repo == "flask"

def test_normalize_github_url_trailing_slash_and_git():
    url, repo = normalize_github_url("https://github.com/psf/requests.git/")
    assert url == "https://github.com/psf/requests"
    assert repo == "requests"

def test_normalize_github_url_without_scheme():
    url, repo = normalize_github_url("github.com/encode/starlette")
    assert url == "https://github.com/encode/starlette"
    assert repo == "starlette"

def test_normalize_github_url_invalid():
    with pytest.raises(ValueError):
        normalize_github_url("invalid_url_without_slashes")

def test_extract_markdown_files_and_exclusions():
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create valid markdown file
        doc_dir = os.path.join(temp_dir, "docs")
        os.makedirs(doc_dir, exist_ok=True)
        with open(os.path.join(doc_dir, "index.md"), "w", encoding="utf-8") as f:
            f.write("# Home\nWelcome to docs")

        # Create valid mdx file
        with open(os.path.join(doc_dir, "component.mdx"), "w", encoding="utf-8") as f:
            f.write("# Component\nInteractive docs")

        # Create markdown file inside node_modules (should be excluded)
        nm_dir = os.path.join(temp_dir, "node_modules", "pkg")
        os.makedirs(nm_dir, exist_ok=True)
        with open(os.path.join(nm_dir, "README.md"), "w", encoding="utf-8") as f:
            f.write("# Third party")

        # Create non-markdown file (should be ignored)
        with open(os.path.join(temp_dir, "main.py"), "w", encoding="utf-8") as f:
            f.write("print('hello')")

        files = list(extract_markdown_files(temp_dir))
        filepaths = [f["filepath"] for f in files]

        assert any("index.md" in p for p in filepaths)
        assert any("component.mdx" in p for p in filepaths)
        assert not any("node_modules" in p for p in filepaths)
        assert not any("main.py" in p for p in filepaths)

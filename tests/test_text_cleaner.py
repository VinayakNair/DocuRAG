import pytest
from processing.text_cleaner import clean_markdown

def test_clean_markdown_empty():
    assert clean_markdown("") == ""
    assert clean_markdown("   \n\n  ") == ""

def test_strip_markdown_images():
    text = "Here is an image: ![DocuRAG Logo](https://example.com/logo.png) that should be removed."
    cleaned = clean_markdown(text)
    assert "![DocuRAG Logo]" not in cleaned
    assert "logo.png" not in cleaned
    assert "DocuRAG Logo" not in cleaned
    assert "Here is an image:  that should be removed." == cleaned

def test_simplify_markdown_links():
    text = "Visit [FastAPI Documentation](https://fastapi.tiangolo.com/) for more details."
    cleaned = clean_markdown(text)
    assert "[FastAPI Documentation]" not in cleaned
    assert "https://fastapi.tiangolo.com/" not in cleaned
    assert "FastAPI Documentation" in cleaned
    assert cleaned == "Visit FastAPI Documentation for more details."

def test_strip_html_tags():
    text = "<div><p>This is <strong>important</strong> documentation.</p><br/></div>"
    cleaned = clean_markdown(text)
    assert "<div>" not in cleaned
    assert "<p>" not in cleaned
    assert "<strong>" not in cleaned
    assert "This is important documentation." in cleaned

def test_preserve_code_block_generics():
    text = """# API Reference

```python
from typing import List, Dict, Optional

def fetch_users() -> List<User>:
    return []
```

Check `Dict<str, int>` for config options.
"""
    cleaned = clean_markdown(text)
    # The code block must retain List<User> and Dict<str, int> without HTML stripping
    assert "List<User>" in cleaned
    assert "`Dict<str, int>`" in cleaned
    assert "```python" in cleaned

def test_normalize_excessive_newlines():
    text = "Line 1\n\n\n\n\nLine 2\n\n\n\nLine 3"
    cleaned = clean_markdown(text)
    assert "\n\n\n" not in cleaned
    assert cleaned == "Line 1\n\nLine 2\n\nLine 3"

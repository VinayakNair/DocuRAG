import re
from bs4 import BeautifulSoup

def clean_markdown(text: str) -> str:
    """
    Cleans markdown text by removing HTML tags, excessive whitespace,
    and simplifying links while preserving code blocks and code generics.
    """
    if not text:
        return ""

    # Protect code blocks and inline code so HTML parsers don't strip generics like List[str] or List<str>
    code_blocks = []

    def save_code(match):
        code_blocks.append(match.group(0))
        return f"__DOCURAG_CODE_BLOCK_{len(code_blocks) - 1}__"

    # Match triple-backtick blocks and single-backtick inline code
    text_masked = re.sub(r"(```[\s\S]*?```|`[^`\n]+`)", save_code, text)

    # 1. Remove markdown image syntax before links (![alt](url))
    text_no_images = re.sub(r"!\[([^\]]*)\]\([^\)]+\)", "", text_masked)

    # 2. Remove or simplify markdown links, keeping just the text (e.g. [text](url) -> text)
    text_no_links = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text_no_images)

    # 3. Remove HTML tags using BeautifulSoup safely (code blocks are protected)
    soup = BeautifulSoup(text_no_links, "html.parser")
    text_no_html = soup.get_text()

    # 4. Restore preserved code blocks
    for idx, block in enumerate(code_blocks):
        text_no_html = text_no_html.replace(f"__DOCURAG_CODE_BLOCK_{idx}__", block)

    # 5. Replace multiple newlines with a double newline
    cleaned = re.sub(r"\n{3,}", "\n\n", text_no_html)

    return cleaned.strip()

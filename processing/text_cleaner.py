import re
from bs4 import BeautifulSoup

def clean_markdown(text: str) -> str:
    """
    Cleans markdown text by removing HTML tags, excessive whitespace,
    and optionally simplifying links or images.
    """
    # Remove HTML tags using BeautifulSoup
    soup = BeautifulSoup(text, 'html.parser')
    text_no_html = soup.get_text()

    # Remove or simplify markdown links, keeping just the text (e.g. [text](url) -> text)
    text_no_links = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text_no_html)

    # Remove markdown image syntax
    text_no_images = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text_no_links)

    # Replace multiple newlines with a single newline or double newline
    cleaned = re.sub(r'\n{3,}', '\n\n', text_no_images)

    return cleaned.strip()

"""
Suggestion Generator Module for DocuRAG.
Analyzes ingested markdown documentation and generates relevant, natural-language
questions and search suggestions tailored specifically to each repository.
"""

import re
from typing import List, Dict, Any, Optional

GENERIC_HEADINGS_TO_IGNORE = {
    "license", "licence", "contributing", "contribution", "contributors",
    "table of contents", "toc", "author", "authors", "changelog",
    "releases", "requirements", "dependencies", "stars", "sponsors",
    "code of conduct", "acknowledgments", "acknowledgements", "support",
    "donation", "donations", "links", "badges", "disclaimer", "overview",
    "contents", "index", "credits", "privacy", "security"
}

PRESET_SUGGESTIONS = {
    "fastapi": [
        "How does dependency injection work in FastAPI?",
        "How to configure CORS middleware safely?",
        "How to handle background tasks and worker threads?",
        "How to define path parameters with Pydantic validation?"
    ],
    "tiangolo/fastapi": [
        "How does dependency injection work in FastAPI?",
        "How to configure CORS middleware safely?",
        "How to handle background tasks and worker threads?",
        "How to define path parameters with Pydantic validation?"
    ],
    "flask": [
        "How to define application factories and blueprints in Flask?",
        "How to manage database sessions and transactions with Flask-SQLAlchemy?",
        "How to implement custom error handlers and abort()?",
        "How to configure Jinja2 templates and context processors?"
    ],
    "pallets/flask": [
        "How to define application factories and blueprints in Flask?",
        "How to manage database sessions and transactions with Flask-SQLAlchemy?",
        "How to implement custom error handlers and abort()?",
        "How to configure Jinja2 templates and context processors?"
    ],
    "starlette": [
        "How does the ASGI request and response lifecycle work in Starlette?",
        "How to implement WebSocket endpoints and connection managers?",
        "How to configure middleware and routing tables in Starlette?",
        "How to manage background tasks and lifespan events?"
    ],
    "encode/starlette": [
        "How does the ASGI request and response lifecycle work in Starlette?",
        "How to implement WebSocket endpoints and connection managers?",
        "How to configure middleware and routing tables in Starlette?",
        "How to manage background tasks and lifespan events?"
    ],
    "requests": [
        "How to configure session pooling and keep-alive connections?",
        "How to handle HTTP timeouts, retries, and backoff in Requests?",
        "How to upload multipart files and custom headers in Requests?",
        "How does custom authentication and hook callbacks work?"
    ],
    "psf/requests": [
        "How to configure session pooling and keep-alive connections?",
        "How to handle HTTP timeouts, retries, and backoff in Requests?",
        "How to upload multipart files and custom headers in Requests?",
        "How does custom authentication and hook callbacks work?"
    ],
    "omniroute": [
        "What routing algorithms and pathfinding models does OmniRoute support?",
        "How to configure transit networks and transport modes in OmniRoute?",
        "How to set up and run the OmniRoute simulation engine?",
        "How to export route metrics and turn-by-turn directions?"
    ],
    "diegosouzapw/omniroute": [
        "What routing algorithms and pathfinding models does OmniRoute support?",
        "How to configure transit networks and transport modes in OmniRoute?",
        "How to set up and run the OmniRoute simulation engine?",
        "How to export route metrics and turn-by-turn directions?"
    ]
}


def clean_heading_text(heading: str) -> str:
    """Strip markdown formatting, badges, links, hashes, and backticks from headings."""
    # Strip leading markdown hashes (#, ##, ###)
    text = re.sub(r'^#+\s*', '', heading)
    # Remove markdown links [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove images ![alt](url)
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)
    # Remove backticks, bold, italics
    text = re.sub(r'[`*_~]', '', text)
    # Remove emojis / badges
    text = re.sub(r':[a-zA-Z0-9_-]+:', '', text)
    # Strip leading numbers or bullets (e.g. "1. Installation")
    text = re.sub(r'^\d+[\.\)]\s*', '', text)
    return text.strip()


def heading_to_question(heading: str, repo_display_name: str) -> Optional[str]:
    """Convert a markdown heading into a natural language query."""
    clean = clean_heading_text(heading)
    if not clean or len(clean) < 3 or len(clean) > 80:
        return None

    lower = clean.lower()
    if lower in GENERIC_HEADINGS_TO_IGNORE:
        return None

    # If it's already a full question
    if clean.endswith('?'):
        return clean

    # Specific category patterns
    if lower in ("installation", "install", "setup", "getting started", "quick start", "quickstart"):
        return f"How to install and set up {repo_display_name}?"

    if lower in ("configuration", "config", "settings", "options"):
        return f"How to configure {repo_display_name}?"

    if lower in ("architecture", "design", "how it works", "concepts"):
        return f"What is the system architecture of {repo_display_name}?"

    if lower in ("features", "key features", "what is it"):
        return f"What are the main features of {repo_display_name}?"

    if lower in ("examples", "basic usage", "usage", "tutorial"):
        return f"How to get started with basic usage in {repo_display_name}?"

    if lower in ("testing", "tests", "running tests"):
        return f"How to run tests and verify {repo_display_name}?"

    if lower.startswith("how to") or lower.startswith("how do") or lower.startswith("why"):
        return clean if clean.endswith('?') else f"{clean} in {repo_display_name}?"

    if lower.startswith("working with") or lower.startswith("using "):
        return f"How to handle {clean.lower()} in {repo_display_name}?"

    # Generic topic heading
    return f"How to use {clean} in {repo_display_name}?"


def generate_repo_suggestions(docs: List[Dict[str, Any]], repo_name: str, max_suggestions: int = 4) -> List[str]:
    """
    Generate natural-language search questions from documentation files.
    """
    clean_repo = repo_name.split('/')[-1] if '/' in repo_name else repo_name

    # Check preset match first
    normalized_key = repo_name.strip().lower()
    if normalized_key in PRESET_SUGGESTIONS:
        return PRESET_SUGGESTIONS[normalized_key][:max_suggestions]

    short_key = clean_repo.lower()
    if short_key in PRESET_SUGGESTIONS:
        return PRESET_SUGGESTIONS[short_key][:max_suggestions]

    questions: List[str] = []
    seen = set()

    # Prioritize README and index documentation files
    sorted_docs = sorted(
        docs,
        key=lambda d: 0 if "readme" in (d.get("source") or d.get("filepath", "")).lower() else (1 if "index" in (d.get("source") or d.get("filepath", "")).lower() else 2)
    )

    # Extract headings (h1, h2, h3)
    heading_pattern = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)

    for doc in sorted_docs:
        content = doc.get("content", "")
        for match in heading_pattern.finditer(content):
            raw_heading = match.group(2)
            q = heading_to_question(raw_heading, clean_repo)
            if q and q.lower() not in seen:
                seen.add(q.lower())
                questions.append(q)
                if len(questions) >= max_suggestions:
                    break
        if len(questions) >= max_suggestions:
            break

    # Fallback questions if not enough headings found
    fallbacks = [
        f"What is {clean_repo} and what are its key features?",
        f"How to install and configure {clean_repo}?",
        f"How to get started with basic usage in {clean_repo}?",
        f"What are the core components and architecture of {clean_repo}?"
    ]

    for fb in fallbacks:
        if len(questions) >= max_suggestions:
            break
        if fb.lower() not in seen:
            seen.add(fb.lower())
            questions.append(fb)

    return questions[:max_suggestions]

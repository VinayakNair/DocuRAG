import pytest
from processing.suggestion_generator import (
    generate_repo_suggestions,
    clean_heading_text,
    heading_to_question
)

def test_preset_suggestions():
    fastapi_qs = generate_repo_suggestions([], "tiangolo/fastapi")
    assert len(fastapi_qs) == 4
    assert any("FastAPI" in q for q in fastapi_qs)

    omni_qs = generate_repo_suggestions([], "diegosouzapw/OmniRoute")
    assert len(omni_qs) == 4
    assert any("OmniRoute" in q for q in omni_qs)


def test_clean_heading_text():
    raw = "## [Getting Started](https://example.com) with `code` & **bold**!"
    clean = clean_heading_text(raw)
    assert clean == "Getting Started with code & bold!"


def test_heading_to_question_patterns():
    assert heading_to_question("Installation", "MyLib") == "How to install and set up MyLib?"
    assert heading_to_question("Configuration", "MyLib") == "How to configure MyLib?"
    assert heading_to_question("Architecture", "MyLib") == "What is the system architecture of MyLib?"
    assert heading_to_question("License", "MyLib") is None
    assert heading_to_question("Contributing", "MyLib") is None
    assert heading_to_question("WebSocket Routing", "MyLib") == "How to use WebSocket Routing in MyLib?"


def test_dynamic_suggestions_from_docs():
    docs = [
        {
            "source": "README.md",
            "content": """
# SmartTrafficSim

A simulator for urban intersections.

## Features
- Real-time vehicle physics
- Signal optimization

## Route Planning
Algorithms for shortest path.

## Vehicle Coordination
Multi-agent safety protocols.

## License
MIT
"""
        }
    ]

    qs = generate_repo_suggestions(docs, "VinayakNair/SmartTrafficSim")
    assert len(qs) == 4
    assert any("features" in q.lower() for q in qs)
    assert any("route planning" in q.lower() for q in qs)
    assert any("vehicle coordination" in q.lower() for q in qs)
    # License should not be in questions
    assert not any("license" in q.lower() for q in qs)


def test_fallback_suggestions_for_empty_docs():
    qs = generate_repo_suggestions([], "custom/cool-project")
    assert len(qs) == 4
    assert any("cool-project" in q for q in qs)

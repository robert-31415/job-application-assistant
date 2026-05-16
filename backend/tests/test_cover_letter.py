"""Tests for the Cover Letter Generator and Refinement endpoints.

Follows the canonical test pattern from test_analyze.py:
- Separate test database (data/test.db)
- autouse fixture that creates/drops tables and overrides get_db
- anthropic.AsyncAnthropic.messages.create is mocked with real TextBlock/Message
  instances as required by CLAUDE.md CI Configuration Notes
"""

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from anthropic.types import Message, TextBlock, Usage
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.schemas import CoverLetterOutput, GapAnalysisOutput, JDAnalysisOutput

os.makedirs("data", exist_ok=True)

TEST_DATABASE_URL = "sqlite+aiosqlite:///./data/test.db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    """Yield a session bound to the test database."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides[get_db] = override_get_db
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

_MOCK_JD_ANALYSIS = JDAnalysisOutput(
    role_title="Senior Software Engineer",
    company="Acme Corp",
    required_skills=["Python", "FastAPI", "PostgreSQL"],
    nice_to_have_skills=["Kubernetes"],
    seniority_level="senior",
    location="Remote (US)",
    salary_hint=None,
    company_research="Acme Corp is a leading SaaS company known for developer tools.",
    key_responsibilities=["Design scalable APIs", "Mentor junior engineers"],
)

_MOCK_GAP_ANALYSIS = GapAnalysisOutput(
    match_score=78,
    match_reasoning="Strong Python background; PostgreSQL experience absent.",
    strengths=[
        "5 years Python experience directly matches the primary language requirement",
        "FastAPI projects demonstrate relevant framework knowledge",
        "Previous tech lead role shows readiness for senior responsibilities",
    ],
    gaps=["No PostgreSQL experience mentioned; only MySQL listed"],
    suggestions=["Add a PostgreSQL project or certification to the resume"],
)

_MOCK_COVER_LETTER_TEXT = (
    "Acme Corp's commitment to developer tooling caught my attention immediately. "
    "After reviewing the Senior Software Engineer role, I am confident my background "
    "makes me a strong candidate.\n\n"
    "My five years of Python experience map directly to your primary language requirement. "
    "My FastAPI projects demonstrate the framework knowledge your team relies on. "
    "As a former tech lead I have guided teams through the same challenges your seniors face.\n\n"
    "I would welcome the opportunity to discuss how I can contribute to Acme Corp. "
    "Please feel free to reach out to schedule an interview at your convenience."
)

_MOCK_RESUME_TEXT = "Senior engineer with 5 years Python, FastAPI, MySQL. Led team of 4."


def _make_mock_claude_response(letter_text: str) -> Message:
    """Build a realistic Message response with a real TextBlock."""
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        content=[TextBlock(type="text", text=letter_text)],
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=10, output_tokens=120),
    )


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _create_resume(raw_text: str = _MOCK_RESUME_TEXT) -> int:
    """Insert a Resume row and return its id."""
    from app.models.db import Resume

    async with TestSessionLocal() as session:
        row = Resume(filename="resume.pdf", raw_text=raw_text)
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row.id


async def _create_application(
    jd_analysis_json: str | None = None,
    gap_analysis_json: str | None = None,
    cover_letter_text: str | None = None,
    cover_letter_versions_json: str | None = None,
) -> int:
    """Insert an Application row and return its id."""
    from app.models.db import Application

    async with TestSessionLocal() as session:
        row = Application(
            company="Acme Corp",
            role_title="Senior Software Engineer",
            status="saved",
            jd_raw="We are hiring a Senior Software Engineer.",
            jd_analysis_json=jd_analysis_json,
            gap_analysis_json=gap_analysis_json,
            cover_letter_text=cover_letter_text,
            cover_letter_versions_json=cover_letter_versions_json,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row.id


# ---------------------------------------------------------------------------
# Tests — generate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_cover_letter_application_not_found_returns_404():
    """POST /api/cover-letter/generate with a non-existent application_id returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/cover-letter/generate", json={"application_id": 9999}
        )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_cover_letter_null_jd_analysis_returns_404():
    """POST /api/cover-letter/generate when jd_analysis_json is null returns 404."""
    app_id = await _create_application(jd_analysis_json=None)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/cover-letter/generate", json={"application_id": app_id}
        )
    assert response.status_code == 404
    assert "no jd analysis" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_cover_letter_no_resume_returns_404():
    """POST /api/cover-letter/generate when no resume exists returns 404."""
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json(),
        gap_analysis_json=_MOCK_GAP_ANALYSIS.model_dump_json(),
    )
    # Intentionally do not create a resume

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/cover-letter/generate", json={"application_id": app_id}
        )
    assert response.status_code == 404
    assert "no resume" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_cover_letter_happy_path():
    """Happy path: returns valid CoverLetterOutput and persists to application row."""
    await _create_resume()
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json(),
        gap_analysis_json=_MOCK_GAP_ANALYSIS.model_dump_json(),
    )

    mock_response = _make_mock_claude_response(_MOCK_COVER_LETTER_TEXT)

    with patch("app.agents.cover_letter.anthropic.AsyncAnthropic") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.messages.create = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/cover-letter/generate",
                json={"application_id": app_id, "tone": "professional"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 1
    assert data["tone"] == "professional"
    assert data["word_count"] > 0
    assert len(data["text"]) > 0

    # Verify persistence
    from sqlalchemy import select

    from app.models.db import Application as AppModel

    async with TestSessionLocal() as session:
        result = await session.execute(select(AppModel).where(AppModel.id == app_id))
        row = result.scalar_one()

    assert row.cover_letter_text == _MOCK_COVER_LETTER_TEXT
    assert row.cover_letter_versions_json is not None
    versions = json.loads(row.cover_letter_versions_json)
    assert len(versions) == 1
    assert versions[0]["version"] == 1


# ---------------------------------------------------------------------------
# Tests — refine
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_refine_cover_letter_no_cover_letter_returns_404():
    """POST /api/cover-letter/refine when cover_letter_text is null returns 404."""
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json(),
        gap_analysis_json=_MOCK_GAP_ANALYSIS.model_dump_json(),
        cover_letter_text=None,
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/cover-letter/refine",
            json={"application_id": app_id, "instruction": "Make it shorter."},
        )
    assert response.status_code == 404
    assert "no cover letter" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_refine_cover_letter_increments_version():
    """Happy path refine: version increments to 2 and appends to versions array."""
    existing_version = CoverLetterOutput(
        version=1,
        tone="professional",
        text=_MOCK_COVER_LETTER_TEXT,
        word_count=len(_MOCK_COVER_LETTER_TEXT.split()),
        generated_at="2026-01-01T00:00:00",
    )
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json(),
        gap_analysis_json=_MOCK_GAP_ANALYSIS.model_dump_json(),
        cover_letter_text=_MOCK_COVER_LETTER_TEXT,
        cover_letter_versions_json=json.dumps([json.loads(existing_version.model_dump_json())]),
    )

    refined_text = "Acme Corp's developer tools drew me in. " + _MOCK_COVER_LETTER_TEXT

    mock_response = _make_mock_claude_response(refined_text)

    with patch("app.agents.cover_letter.anthropic.AsyncAnthropic") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.messages.create = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/cover-letter/refine",
                json={
                    "application_id": app_id,
                    "instruction": "Make the opening more specific.",
                    "tone": "conversational",
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == 2
    assert data["tone"] == "conversational"

    # Verify versions array has 2 entries
    from sqlalchemy import select

    from app.models.db import Application as AppModel

    async with TestSessionLocal() as session:
        result = await session.execute(select(AppModel).where(AppModel.id == app_id))
        row = result.scalar_one()

    versions = json.loads(row.cover_letter_versions_json)
    assert len(versions) == 2
    assert versions[1]["version"] == 2
    assert versions[0]["version"] == 1

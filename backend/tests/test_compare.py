"""Tests for the resume comparison endpoint and agent.

Follows the canonical test pattern from test_analyze.py:
- Separate test database (data/test.db)
- autouse fixture that creates/drops tables and overrides get_db
- anthropic.AsyncAnthropic.messages.create is fully mocked — no real API calls
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
from app.models.schemas import GapAnalysisOutput, JDAnalysisOutput

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
    company_research="Acme Corp builds developer tools.",
    key_responsibilities=["Design scalable APIs", "Mentor junior engineers"],
)

_MOCK_GAP_ANALYSIS = GapAnalysisOutput(
    match_score=78,
    match_reasoning="Strong Python background and API experience; PostgreSQL experience absent.",
    strengths=[
        "5 years Python experience directly matches the primary language requirement",
        "FastAPI projects demonstrate relevant framework knowledge",
        "Previous tech lead role shows readiness for senior responsibilities",
    ],
    gaps=["No PostgreSQL experience mentioned; only MySQL listed"],
    suggestions=[
        "Add a PostgreSQL project or certification to the resume",
        "Quantify API performance improvements (e.g. latency reduced by X%)",
        "List any Kubernetes exposure, even self-study",
    ],
)

_MOCK_JD_RAW = "We are looking for a Senior Software Engineer with Python and FastAPI experience."
_MOCK_RESUME_TEXT = "Senior engineer with 5 years Python, FastAPI, MySQL. Led team of 4."


def _make_mock_claude_response(output: GapAnalysisOutput) -> Message:
    """Build a realistic Message response with a real TextBlock."""
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        content=[TextBlock(type="text", text=output.model_dump_json())],
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=10, output_tokens=50),
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
    jd_raw: str = _MOCK_JD_RAW,
) -> int:
    """Insert an Application row and return its id."""
    from app.models.db import Application

    async with TestSessionLocal() as session:
        row = Application(
            company="Acme Corp",
            role_title="Senior Software Engineer",
            status="saved",
            jd_raw=jd_raw,
            jd_analysis_json=jd_analysis_json,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row.id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_compare_resume_application_not_found_returns_404():
    """POST /api/compare/resume with a non-existent application_id returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/compare/resume", json={"application_id": 9999})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_compare_resume_null_jd_analysis_returns_404():
    """POST /api/compare/resume when jd_analysis_json is null returns 404."""
    app_id = await _create_application(jd_analysis_json=None)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/compare/resume", json={"application_id": app_id})
    assert response.status_code == 404
    assert "no jd analysis" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_compare_resume_no_resume_uploaded_returns_404():
    """POST /api/compare/resume when no resume exists returns 404."""
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json()
    )
    # Intentionally do not create a resume

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/compare/resume", json={"application_id": app_id})
    assert response.status_code == 404
    assert "no resume" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_compare_resume_happy_path():
    """Happy path: returns valid GapAnalysisOutput and persists to the application row."""
    await _create_resume()
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json()
    )

    mock_response = _make_mock_claude_response(_MOCK_GAP_ANALYSIS)

    with patch(
        "app.agents.resume_comparator.anthropic.AsyncAnthropic"
    ) as mock_cls:
        mock_instance = MagicMock()
        mock_instance.messages.create = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/compare/resume", json={"application_id": app_id}
            )

    assert response.status_code == 200
    data = response.json()

    # match_score must be integer 0–100
    assert isinstance(data["match_score"], int)
    assert 0 <= data["match_score"] <= 100
    assert data["match_score"] == 78

    # strengths and gaps must be non-empty lists
    assert isinstance(data["strengths"], list) and len(data["strengths"]) > 0
    assert isinstance(data["gaps"], list) and len(data["gaps"]) > 0
    assert isinstance(data["suggestions"], list) and len(data["suggestions"]) > 0

    # Verify persistence
    from sqlalchemy import select

    from app.models.db import Application as AppModel

    async with TestSessionLocal() as session:
        result = await session.execute(select(AppModel).where(AppModel.id == app_id))
        row = result.scalar_one()

    assert row.match_score == 78
    assert row.gap_analysis_json is not None
    persisted = json.loads(row.gap_analysis_json)
    assert persisted["match_score"] == 78
    assert len(persisted["strengths"]) == 3

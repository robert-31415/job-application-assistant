"""Tests for the Interview Prep generation endpoint and agent.

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

# 10 mock questions matching the required breakdown
_MOCK_QUESTIONS = [
    {"question": "Tell me about a time you led a technical project.", "category": "behavioral", "suggested_framework": "Use STAR: describe the project, your role, the actions you took, and the measurable outcome."},
    {"question": "Describe a situation where you had a conflict with a team member.", "category": "behavioral", "suggested_framework": "Use STAR: describe the disagreement, how you approached the conversation, and the resolution."},
    {"question": "Give an example of a time you improved a system's performance.", "category": "behavioral", "suggested_framework": "Use STAR: describe the system, the bottleneck you identified, the changes you made, and the improvement metrics."},
    {"question": "Tell me about a time you had to meet a tight deadline.", "category": "behavioral", "suggested_framework": "Use STAR: describe the deadline, how you prioritized, what trade-offs you made, and the result."},
    {"question": "How would you design a scalable REST API in Python using FastAPI?", "category": "technical", "suggested_framework": "Cover async/await patterns, dependency injection, Pydantic validation, and horizontal scaling strategies."},
    {"question": "What are the differences between PostgreSQL and MySQL?", "category": "technical", "suggested_framework": "Cover ACID compliance, JSON support, full-text search, concurrency models, and when to use each."},
    {"question": "How does Python's GIL affect multi-threaded applications?", "category": "technical", "suggested_framework": "Explain the GIL mechanism, impact on CPU-bound vs I/O-bound tasks, and alternatives like multiprocessing or async."},
    {"question": "If you joined Acme Corp and found the test coverage was below 20%, what would you do?", "category": "situational", "suggested_framework": "Outline an incremental approach: audit critical paths, add tests alongside feature work, set team coverage goals."},
    {"question": "How would you handle a production outage during your first week?", "category": "situational", "suggested_framework": "Describe incident response steps: triage, communicate status, roll back if needed, write a post-mortem."},
    {"question": "Acme Corp values developer autonomy. How do you stay aligned with your team while working independently?", "category": "culture_fit", "suggested_framework": "Discuss async communication habits, documentation practices, and how you balance independence with collaboration."},
]

_MOCK_INTERVIEW_PREP = {
    "role_title": "Senior Software Engineer",
    "company": "Acme Corp",
    "questions": _MOCK_QUESTIONS,
}


def _make_mock_claude_response(payload: dict) -> Message:
    """Build a realistic Message response with a real TextBlock."""
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        content=[TextBlock(type="text", text=json.dumps(payload))],
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        usage=Usage(input_tokens=10, output_tokens=200),
    )


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _create_application(
    jd_analysis_json: str | None = None,
    gap_analysis_json: str | None = None,
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
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row.id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generate_interview_prep_application_not_found_returns_404():
    """POST /api/interview-prep/generate with a non-existent application_id returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/interview-prep/generate", json={"application_id": 9999}
        )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_interview_prep_null_jd_analysis_returns_404():
    """POST /api/interview-prep/generate when jd_analysis_json is null returns 404."""
    app_id = await _create_application(jd_analysis_json=None)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/interview-prep/generate", json={"application_id": app_id}
        )
    assert response.status_code == 404
    assert "no jd analysis" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_interview_prep_happy_path_returns_10_questions():
    """Happy path: returns InterviewPrepOutput with exactly 10 questions."""
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json(),
        gap_analysis_json=_MOCK_GAP_ANALYSIS.model_dump_json(),
    )

    mock_response = _make_mock_claude_response(_MOCK_INTERVIEW_PREP)

    with patch("app.agents.interview_prep.anthropic.AsyncAnthropic") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.messages.create = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/interview-prep/generate",
                json={"application_id": app_id},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["role_title"] == "Senior Software Engineer"
    assert data["company"] == "Acme Corp"
    assert len(data["questions"]) == 10


@pytest.mark.asyncio
async def test_generate_interview_prep_all_questions_have_required_fields():
    """Every question has non-empty question, category, and suggested_framework."""
    app_id = await _create_application(
        jd_analysis_json=_MOCK_JD_ANALYSIS.model_dump_json(),
        gap_analysis_json=_MOCK_GAP_ANALYSIS.model_dump_json(),
    )

    mock_response = _make_mock_claude_response(_MOCK_INTERVIEW_PREP)

    with patch("app.agents.interview_prep.anthropic.AsyncAnthropic") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.messages.create = AsyncMock(return_value=mock_response)
        mock_cls.return_value = mock_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/interview-prep/generate",
                json={"application_id": app_id},
            )

    assert response.status_code == 200
    for q in response.json()["questions"]:
        assert q["question"], "question must be non-empty"
        assert q["category"], "category must be non-empty"
        assert q["suggested_framework"], "suggested_framework must be non-empty"

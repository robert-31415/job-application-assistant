"""Tests for the JD analysis endpoint and agent.

Follows the canonical test pattern from test_resume.py:
- Separate test database (data/test.db)
- autouse fixture that creates/drops tables and overrides get_db
- Tavily and Claude are fully mocked — no real API calls
"""

import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.schemas import JDAnalysisOutput

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
# Fixtures
# ---------------------------------------------------------------------------

_MOCK_JD_ANALYSIS = JDAnalysisOutput(
    role_title="Senior Software Engineer",
    company="Acme Corp",
    required_skills=["Python", "FastAPI", "PostgreSQL"],
    nice_to_have_skills=["Kubernetes", "Terraform"],
    seniority_level="senior",
    location="Remote (US)",
    salary_hint="$150k–$180k",
    company_research="Acme Corp is a leading SaaS company known for its developer tools.",
    key_responsibilities=[
        "Design and build scalable backend services",
        "Lead code reviews and mentor junior engineers",
    ],
)

_MOCK_JD_RAW = "We are looking for a Senior Software Engineer to join our team..."


def _make_mock_claude_response(output: JDAnalysisOutput) -> MagicMock:
    """Build a mock object that looks like an anthropic Messages response."""
    content_block = MagicMock()
    content_block.text = output.model_dump_json()
    message = MagicMock()
    message.content = [content_block]
    return message


# ---------------------------------------------------------------------------
# Helper: create an application with a JD in the test database
# ---------------------------------------------------------------------------

async def _create_application_with_jd(
    jd_raw: str | None = _MOCK_JD_RAW,
    company: str = "Acme Corp",
) -> int:
    """Insert an Application row directly and return its id."""
    from app.models.db import Application

    async with TestSessionLocal() as session:
        app_row = Application(
            company=company,
            role_title="Senior Software Engineer",
            status="saved",
            jd_raw=jd_raw,
        )
        session.add(app_row)
        await session.commit()
        await session.refresh(app_row)
        return app_row.id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_analyze_jd_application_not_found_returns_404():
    """POST /api/analyze/jd with a non-existent application_id returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/analyze/jd", json={"application_id": 9999})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_analyze_jd_null_jd_raw_returns_404():
    """POST /api/analyze/jd with an application that has no JD text returns 404."""
    app_id = await _create_application_with_jd(jd_raw=None)

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/analyze/jd", json={"application_id": app_id})
    assert response.status_code == 404
    assert "no job description" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_analyze_jd_happy_path_returns_valid_output():
    """Happy path: returns a valid JDAnalysisOutput and persists jd_analysis_json."""
    app_id = await _create_application_with_jd()

    mock_claude = _make_mock_claude_response(_MOCK_JD_ANALYSIS)

    with (
        patch("app.agents.jd_analyzer.TavilyClient") as mock_tavily_cls,
        patch("app.agents.jd_analyzer.anthropic.AsyncAnthropic") as mock_anthropic_cls,
    ):
        # Tavily mock
        mock_tavily_instance = MagicMock()
        mock_tavily_instance.search.return_value = {
            "results": [{"content": "Acme Corp was founded in 2010."}]
        }
        mock_tavily_cls.return_value = mock_tavily_instance

        # Claude mock
        mock_anthropic_instance = MagicMock()
        mock_anthropic_instance.messages.create = AsyncMock(return_value=mock_claude)
        mock_anthropic_cls.return_value = mock_anthropic_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/analyze/jd", json={"application_id": app_id}
            )

    assert response.status_code == 200
    data = response.json()
    assert data["role_title"] == "Senior Software Engineer"
    assert data["company"] == "Acme Corp"
    assert "Python" in data["required_skills"]
    assert data["seniority_level"] == "senior"

    # Verify the result was persisted
    from sqlalchemy import select
    from app.models.db import Application as AppModel

    async with TestSessionLocal() as session:
        result = await session.execute(select(AppModel).where(AppModel.id == app_id))
        row = result.scalar_one()
    assert row.jd_analysis_json is not None
    persisted = json.loads(row.jd_analysis_json)
    assert persisted["role_title"] == "Senior Software Engineer"


@pytest.mark.asyncio
async def test_stream_jd_analysis_yields_sse_tokens_and_done_sentinel():
    """GET /api/analyze/jd/stream yields data: lines for each token and a [DONE] sentinel.

    anthropic.AsyncAnthropic.messages.stream is mocked as an async context manager
    whose text_stream yields two pre-defined chunks, simulating the SDK behaviour.
    get_tavily_snippets is mocked to return an empty list so no real HTTP calls happen.
    """
    app_id = await _create_application_with_jd()

    class _MockStream:
        """Minimal async context manager that mimics anthropic.AsyncMessageStream."""

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        @property
        def text_stream(self):
            async def _gen():
                yield "Hello "
                yield "World"

            return _gen()

    with (
        patch(
            "app.routers.analyze.get_tavily_snippets",
            new=AsyncMock(return_value=[]),
        ),
        patch("app.routers.analyze.anthropic.AsyncAnthropic") as mock_cls,
    ):
        mock_instance = MagicMock()
        mock_instance.messages.stream.return_value = _MockStream()
        mock_cls.return_value = mock_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                f"/api/analyze/jd/stream?application_id={app_id}"
            )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "data: Hello " in response.text
    assert "data: World" in response.text
    assert "data: [DONE]" in response.text


@pytest.mark.asyncio
async def test_stream_jd_analysis_missing_application_returns_404():
    """GET /api/analyze/jd/stream with a non-existent application_id returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/analyze/jd/stream?application_id=9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_analyze_jd_tavily_failure_still_returns_output():
    """Tavily failures are soft — the agent falls back gracefully and Claude still runs."""
    app_id = await _create_application_with_jd()

    mock_claude = _make_mock_claude_response(_MOCK_JD_ANALYSIS)

    with (
        patch("app.agents.jd_analyzer.TavilyClient") as mock_tavily_cls,
        patch("app.agents.jd_analyzer.anthropic.AsyncAnthropic") as mock_anthropic_cls,
    ):
        # Tavily raises an exception
        mock_tavily_instance = MagicMock()
        mock_tavily_instance.search.side_effect = RuntimeError("network error")
        mock_tavily_cls.return_value = mock_tavily_instance

        mock_anthropic_instance = MagicMock()
        mock_anthropic_instance.messages.create = AsyncMock(return_value=mock_claude)
        mock_anthropic_cls.return_value = mock_anthropic_instance

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/analyze/jd", json={"application_id": app_id}
            )

    assert response.status_code == 200
    assert response.json()["role_title"] == "Senior Software Engineer"

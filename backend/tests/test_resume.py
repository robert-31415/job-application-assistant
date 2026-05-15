"""Tests for the resume upload and retrieval endpoints."""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

os.makedirs("data", exist_ok=True)

TEST_DATABASE_URL = "sqlite+aiosqlite:///./data/test.db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides[get_db] = override_get_db
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_current_resume_no_upload_returns_404():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/resume/current")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_invalid_content_type_returns_422():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/resume/upload",
            files={"file": ("test.txt", b"not a pdf", "text/plain")},
        )
    assert response.status_code == 422
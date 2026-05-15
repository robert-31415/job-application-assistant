"""Tests for the resume upload and retrieval endpoints."""

import io

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_get_current_resume_no_upload_returns_404() -> None:
    """GET /api/resume/current should return 404 when no resume has been uploaded."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/resume/current")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_invalid_content_type_returns_422() -> None:
    """Uploading a plain text file should be rejected with 422."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/resume/upload",
            files={"file": ("resume.txt", io.BytesIO(b"plain text"), "text/plain")},
        )
    assert response.status_code == 422

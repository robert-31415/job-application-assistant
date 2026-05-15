"""Job description analysis endpoints.

POST /api/analyze/jd        — run JD analysis agent (non-streaming)
GET  /api/analyze/jd/stream — SSE stream of JD analysis tokens
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api/analyze", tags=["analyze"])


@router.post("/jd")
async def analyze_jd(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Run the JD Analyzer agent on a pasted job description.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 2"}


@router.get("/jd/stream")
async def analyze_jd_stream(
    app_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Stream JD analysis tokens via Server-Sent Events.

    Not yet implemented — Phase 2.
    """
    return {"detail": "Not implemented — Phase 2"}

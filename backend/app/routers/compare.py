"""Resume comparison endpoints.

POST /api/compare/resume — run gap analysis agent comparing resume to JD
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.post("/resume")
async def compare_resume(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Run the Resume Comparator agent for a given application.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 3"}

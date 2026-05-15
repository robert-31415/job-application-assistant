"""Interview preparation endpoints.

POST /api/interview-prep/generate — generate likely interview questions for a role
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api/interview-prep", tags=["interview-prep"])


@router.post("/generate")
async def generate_interview_prep(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate role-specific interview questions and answer frameworks.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 6"}

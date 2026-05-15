"""DOCX export endpoints.

GET /api/export/cover-letter/{id}    — download cover letter as .docx
GET /api/export/interview-prep/{id}  — download interview prep sheet as .docx
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/cover-letter/{app_id}")
async def export_cover_letter(
    app_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Generate and return a DOCX file containing the cover letter for an application.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 6"}


@router.get("/interview-prep/{app_id}")
async def export_interview_prep(
    app_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Generate and return a DOCX interview prep sheet for an application.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 6"}

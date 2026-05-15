"""Cover letter generation and refinement endpoints.

POST /api/cover-letter/generate — generate an initial cover letter
POST /api/cover-letter/refine   — iterate on an existing cover letter
GET  /api/cover-letter/stream   — SSE stream of generation tokens
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/api/cover-letter", tags=["cover-letter"])


@router.post("/generate")
async def generate_cover_letter(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate an initial cover letter tailored to the application's JD.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 4"}


@router.post("/refine")
async def refine_cover_letter(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Iterate on an existing cover letter based on user instructions.

    Not yet implemented — returns a placeholder response.
    """
    return {"detail": "Not implemented — Phase 4"}


@router.get("/stream")
async def cover_letter_stream(
    app_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Stream cover letter generation tokens via Server-Sent Events.

    Not yet implemented — Phase 4.
    """
    return {"detail": "Not implemented — Phase 4"}

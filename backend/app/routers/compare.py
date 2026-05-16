"""Resume comparison endpoints.

POST /api/compare/resume — run gap analysis agent comparing resume to JD.

Requires the application to have already been analysed (jd_analysis_json must be
non-null). Run POST /api/analyze/jd first if it isn't.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.resume_comparator import compare_resume
from app.database import get_db
from app.models.db import Application, Resume
from app.models.schemas import CompareResumeRequest, GapAnalysisOutput, JDAnalysisOutput

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.post("/resume", response_model=GapAnalysisOutput)
async def compare_resume_endpoint(
    payload: CompareResumeRequest,
    db: AsyncSession = Depends(get_db),
) -> GapAnalysisOutput:
    """Run the Resume Comparator agent for a given application.

    Loads the Application and the most recently uploaded Resume, passes them to the
    agent alongside the stored JD analysis, persists match_score and gap_analysis_json
    back to the application row, and returns the GapAnalysisOutput.

    Prerequisites:
    - An application with the given ID must exist.
    - The application must have a non-null jd_analysis_json (run /api/analyze/jd first).
    - At least one resume must have been uploaded (run /api/resume/upload first).

    Returns 404 if any of the above prerequisites are not met.
    """
    # --- Load and validate the application ---
    app_result = await db.execute(
        select(Application).where(Application.id == payload.application_id)
    )
    application = app_result.scalar_one_or_none()

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {payload.application_id} not found.",
        )

    if not application.jd_analysis_json:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Application {payload.application_id} has no JD analysis. "
                "Run POST /api/analyze/jd first."
            ),
        )

    # --- Load the most recently uploaded resume ---
    resume_result = await db.execute(
        select(Resume).order_by(Resume.uploaded_at.desc()).limit(1)
    )
    resume = resume_result.scalar_one_or_none()

    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume has been uploaded. Upload a resume first.",
        )

    # --- Parse the stored JD analysis ---
    jd_analysis = JDAnalysisOutput.model_validate_json(application.jd_analysis_json)

    logger.info(
        "Starting gap analysis for application %d (%s at %s)",
        application.id,
        application.role_title,
        application.company,
    )

    try:
        output = await compare_resume(
            resume_text=resume.raw_text,
            jd_analysis=jd_analysis,
            jd_raw=application.jd_raw or "",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI model returned an unparseable response: {exc}",
        ) from exc

    # --- Persist results ---
    application.match_score = output.match_score
    application.gap_analysis_json = output.model_dump_json()
    await db.commit()

    return output

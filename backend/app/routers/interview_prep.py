"""Interview preparation endpoints.

POST /api/interview-prep/generate — generate likely interview questions for a role
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.interview_prep import generate_interview_questions
from app.database import get_db
from app.models.db import Application
from app.models.schemas import (
    GapAnalysisOutput,
    InterviewPrepGenerateRequest,
    InterviewPrepOutput,
    JDAnalysisOutput,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview-prep", tags=["interview-prep"])


@router.post("/generate", response_model=InterviewPrepOutput)
async def generate_interview_prep_endpoint(
    payload: InterviewPrepGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> InterviewPrepOutput:
    """Generate 10 role-specific interview questions with answer frameworks.

    Requires the application to have both jd_analysis_json and gap_analysis_json
    populated (run /api/analyze/jd and /api/compare/resume first).

    Returns 404 if the application is missing, jd_analysis_json is null,
    or gap_analysis_json is null.
    """
    result = await db.execute(
        select(Application).where(Application.id == payload.application_id)
    )
    application = result.scalar_one_or_none()

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {payload.application_id} not found.",
        )
    if not application.jd_analysis_json:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {payload.application_id} has no JD analysis. Run /api/analyze/jd first.",
        )
    if not application.gap_analysis_json:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {payload.application_id} has no gap analysis. Run /api/compare/resume first.",
        )

    jd_analysis = JDAnalysisOutput.model_validate_json(application.jd_analysis_json)
    gap_analysis = GapAnalysisOutput.model_validate_json(application.gap_analysis_json)

    logger.info(
        "Generating interview prep for application %d (%s — %s)",
        application.id,
        application.company,
        application.role_title,
    )

    try:
        output = await generate_interview_questions(jd_analysis, gap_analysis)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI model returned an unparseable response: {exc}",
        ) from exc

    application.interview_prep_json = output.model_dump_json()
    await db.commit()

    return output

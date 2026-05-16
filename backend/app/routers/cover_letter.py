"""Cover letter generation and refinement endpoints.

POST /api/cover-letter/generate — generate an initial cover letter
POST /api/cover-letter/refine   — iterate on an existing cover letter
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.cover_letter import (
    generate_cover_letter as agent_generate,
    refine_cover_letter as agent_refine,
)
from app.database import get_db
from app.models.db import Application, Resume
from app.models.schemas import (
    CoverLetterGenerateRequest,
    CoverLetterOutput,
    CoverLetterRefineRequest,
    GapAnalysisOutput,
    JDAnalysisOutput,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cover-letter", tags=["cover-letter"])


def _parse_versions(raw: str | None) -> list[dict]:
    """Deserialise the cover_letter_versions_json column, defaulting to []."""
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


@router.post("/generate", response_model=CoverLetterOutput)
async def generate_cover_letter_endpoint(
    payload: CoverLetterGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> CoverLetterOutput:
    """Generate an initial cover letter tailored to the application's JD and resume.

    Requires the application to already have both jd_analysis_json and
    gap_analysis_json populated (run /api/analyze/jd and /api/compare/resume first).
    Also requires at least one uploaded resume.

    Returns 404 if the application is missing, jd_analysis_json is null,
    gap_analysis_json is null, or no resume has been uploaded.
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

    resume_result = await db.execute(
        select(Resume).order_by(Resume.uploaded_at.desc()).limit(1)
    )
    resume = resume_result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume found. Upload a resume first.",
        )

    jd_analysis = JDAnalysisOutput.model_validate_json(application.jd_analysis_json)
    gap_analysis = GapAnalysisOutput.model_validate_json(application.gap_analysis_json)

    versions = _parse_versions(application.cover_letter_versions_json)
    next_version = len(versions) + 1

    logger.info(
        "Generating cover letter v%d for application %d (%s), tone=%s",
        next_version,
        application.id,
        application.company,
        payload.tone,
    )

    output = await agent_generate(
        resume_text=resume.raw_text,
        jd_analysis=jd_analysis,
        gap_analysis=gap_analysis,
        tone=payload.tone,
        version=next_version,
    )

    versions.append(json.loads(output.model_dump_json()))
    application.cover_letter_text = output.text
    application.cover_letter_versions_json = json.dumps(versions)
    await db.commit()

    return output


@router.post("/refine", response_model=CoverLetterOutput)
async def refine_cover_letter_endpoint(
    payload: CoverLetterRefineRequest,
    db: AsyncSession = Depends(get_db),
) -> CoverLetterOutput:
    """Iterate on an existing cover letter with a user-provided instruction.

    Requires the application to already have a cover_letter_text (run generate first).

    Returns 404 if the application is missing or has no cover letter text.
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
    if not application.cover_letter_text:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {payload.application_id} has no cover letter. Run /api/cover-letter/generate first.",
        )

    versions = _parse_versions(application.cover_letter_versions_json)
    next_version = len(versions) + 1

    logger.info(
        "Refining cover letter v%d for application %d (%s), tone=%s",
        next_version,
        application.id,
        application.company,
        payload.tone,
    )

    output = await agent_refine(
        current_text=application.cover_letter_text,
        instruction=payload.instruction,
        tone=payload.tone,
        version=next_version,
    )

    versions.append(json.loads(output.model_dump_json()))
    application.cover_letter_text = output.text
    application.cover_letter_versions_json = json.dumps(versions)
    await db.commit()

    return output

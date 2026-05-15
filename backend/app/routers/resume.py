"""Resume upload and retrieval endpoints.

POST /api/resume/upload  — accepts PDF or DOCX, extracts text, persists to DB
GET  /api/resume/current — returns the most recently uploaded resume
"""

import io

import fitz  # PyMuPDF
from docx import Document
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db import Resume
from app.models.schemas import ResumeResponse

router = APIRouter(prefix="/api/resume", tags=["resume"])

_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB


def _extract_text_from_pdf(data: bytes) -> str:
    """Extract plain text from PDF bytes using PyMuPDF."""
    text_parts: list[str] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts).strip()


def _extract_text_from_docx(data: bytes) -> str:
    """Extract plain text from DOCX bytes using python-docx."""
    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()


@router.post("/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ResumeResponse:
    """Accept a PDF or DOCX resume, extract its text, and persist it to the database.

    Replaces any previously stored resume — only one active resume exists at a time.
    """
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{file.content_type}'. Upload a PDF or DOCX.",
        )

    raw = await file.read()

    if len(raw) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 5 MB size limit.",
        )

    if file.content_type == "application/pdf":
        extracted = _extract_text_from_pdf(raw)
    else:
        extracted = _extract_text_from_docx(raw)

    if not extracted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract text from the uploaded file. Ensure it is not scanned or image-only.",
        )

    resume = Resume(filename=file.filename or "resume", raw_text=extracted)
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return ResumeResponse.model_validate(resume)


@router.get("/current", response_model=ResumeResponse)
async def get_current_resume(db: AsyncSession = Depends(get_db)) -> ResumeResponse:
    """Return the most recently uploaded resume, or 404 if none exists."""
    result = await db.execute(
        select(Resume).order_by(Resume.uploaded_at.desc()).limit(1)
    )
    resume = result.scalar_one_or_none()

    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No resume has been uploaded yet.",
        )

    return ResumeResponse.model_validate(resume)

"""Application CRUD endpoints.

GET    /api/applications      — list all applications (with optional status filter)
POST   /api/applications      — create a new application record
PATCH  /api/applications/{id} — update status, notes, or other fields
DELETE /api/applications/{id} — delete an application
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db import Application
from app.models.schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    KANBAN_STATUSES,
)

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[ApplicationResponse]:
    """Return all application records, optionally filtered by Kanban status."""
    query = select(Application).order_by(Application.created_at.desc())
    if status_filter:
        query = query.where(Application.status == status_filter)
    result = await db.execute(query)
    rows = result.scalars().all()
    return [ApplicationResponse.model_validate(r) for r in rows]


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
) -> ApplicationResponse:
    """Create a new application record starting in the 'saved' status lane."""
    app = Application(
        company=payload.company,
        role_title=payload.role_title,
        jd_raw=payload.jd_raw,
        status="saved",
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return ApplicationResponse.model_validate(app)


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: int,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApplicationResponse:
    """Partially update an application — status, notes, company, role, or JD text."""
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    if payload.status is not None and payload.status not in KANBAN_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status '{payload.status}'. Must be one of: {sorted(KANBAN_STATUSES)}",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(app, field, value)

    await db.commit()
    await db.refresh(app)
    return ApplicationResponse.model_validate(app)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    app_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete an application and all associated data."""
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    await db.delete(app)
    await db.commit()

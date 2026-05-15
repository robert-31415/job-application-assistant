"""FastAPI application entry point.

Mounts all routers, configures CORS, and initialises the database on startup.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    analyze,
    applications,
    compare,
    cover_letter,
    export,
    interview_prep,
    resume,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Run database initialisation on startup; nothing special on shutdown."""
    logger.info("Initialising database...")
    await init_db()
    logger.info("Database ready.")
    yield


app = FastAPI(
    title="Agentic Job Application Assistant",
    description="Multi-agent AI system for resume analysis, cover letter generation, and application tracking.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router)
app.include_router(analyze.router)
app.include_router(compare.router)
app.include_router(cover_letter.router)
app.include_router(applications.router)
app.include_router(export.router)
app.include_router(interview_prep.router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Liveness probe — returns 200 when the server is up."""
    return {"status": "ok"}

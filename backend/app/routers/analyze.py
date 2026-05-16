"""Job description analysis endpoints.

POST /api/analyze/jd        — run JD analysis agent, returns single JSON response.
GET  /api/analyze/jd/stream — SSE stream of token-by-token Claude output.

The streaming endpoint is read-only: it calls Tavily + Claude and streams tokens
back to the client, but does NOT persist anything to the database. Persistence is
the sole responsibility of POST /api/analyze/jd.
"""

import logging
from collections.abc import AsyncGenerator

import anthropic
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.jd_analyzer import (
    SYSTEM_PROMPT,
    analyze_jd,
    build_user_message,
    get_tavily_snippets,
)
from app.config import settings
from app.database import get_db
from app.models.db import Application
from app.models.schemas import JDAnalysisOutput, JDAnalyzeRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["analyze"])


async def _load_application_with_jd(
    application_id: int, db: AsyncSession
) -> Application:
    """Load an Application row and validate that it has a job description.

    Raises HTTPException 404 if the row is missing or jd_raw is null.
    Extracted as a helper so both endpoints share the same guard logic.
    """
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found.",
        )
    if not application.jd_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} has no job description text.",
        )
    return application


@router.post("/jd", response_model=JDAnalysisOutput)
async def analyze_jd_endpoint(
    payload: JDAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
) -> JDAnalysisOutput:
    """Run the JD Analyzer agent on the job description stored in an application record.

    Loads the Application by ID, passes its jd_raw text to the agent (which calls
    Tavily + Claude), persists the structured result back to the database, and returns
    the JDAnalysisOutput.

    Returns 404 if the application does not exist or has no job description text.
    """
    application = await _load_application_with_jd(payload.application_id, db)
    assert application.jd_raw is not None  # narrowed above by 404 guard

    logger.info(
        "Starting JD analysis for application %d (%s)",
        application.id,
        application.company,
    )

    try:
        output = await analyze_jd(
            jd_raw=application.jd_raw,
            company_hint=application.company,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI model returned an unparseable response: {exc}",
        ) from exc

    # Persist the result so it can be shown on the Kanban card later
    application.jd_analysis_json = output.model_dump_json()
    await db.commit()

    return output


@router.get("/jd/stream")
async def stream_jd_analysis(
    application_id: int,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream JD analysis tokens to the client via Server-Sent Events.

    Performs the same Tavily enrichment + Claude call as POST /api/analyze/jd,
    but delivers output token-by-token as SSE events so the UI can render
    progressively. Does NOT persist anything — call the POST endpoint to save.

    Each SSE event is formatted as:  data: {token}\\n\\n
    The final event is:              data: [DONE]\\n\\n

    Returns 404 if the application does not exist or has no job description text.
    """
    # Perform all DB access and validation before opening the streaming response.
    # Once StreamingResponse is returned, we can no longer raise HTTPException.
    application = await _load_application_with_jd(application_id, db)
    assert application.jd_raw is not None  # narrowed above by 404 guard

    company_snippets = await get_tavily_snippets(application.company)
    user_message = build_user_message(application.jd_raw, company_snippets)

    logger.info(
        "Starting streaming JD analysis for application %d (%s)",
        application.id,
        application.company,
    )

    async def token_generator() -> AsyncGenerator[str, None]:
        """Yield SSE-formatted token strings from the Claude streaming API."""
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        async with client.messages.stream(
            model=settings.claude_model,
            max_tokens=settings.max_tokens,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {text}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        token_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

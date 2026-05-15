"""Pydantic v2 schemas for agent I/O and API request/response contracts."""

from datetime import datetime

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Resume schemas
# ---------------------------------------------------------------------------


class ResumeResponse(BaseModel):
    """Returned after a successful resume upload or when fetching the current resume."""

    id: int
    filename: str
    raw_text: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Application schemas
# ---------------------------------------------------------------------------

KANBAN_STATUSES = {"saved", "applied", "screen", "interview", "offer", "rejected"}


class ApplicationCreate(BaseModel):
    """Payload for creating a new application record."""

    company: str
    role_title: str
    jd_raw: str | None = None


class ApplicationUpdate(BaseModel):
    """Partial update payload — all fields optional."""

    company: str | None = None
    role_title: str | None = None
    status: str | None = None
    notes: str | None = None
    jd_raw: str | None = None


class ApplicationResponse(BaseModel):
    """Full application record returned by the API."""

    id: int
    company: str
    role_title: str
    status: str
    jd_raw: str | None
    jd_analysis_json: str | None
    match_score: int | None
    gap_analysis_json: str | None
    cover_letter_text: str | None
    cover_letter_versions_json: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Agent output schemas
# ---------------------------------------------------------------------------


class JDAnalysisOutput(BaseModel):
    """Structured output from the JD Analyzer agent."""

    role_title: str
    company: str
    required_skills: list[str]
    nice_to_have_skills: list[str]
    seniority_level: str = Field(
        description="One of: junior / mid / senior / staff / exec"
    )
    location: str
    salary_hint: str | None = None
    company_research: str = Field(description="Tavily-enriched company summary")
    key_responsibilities: list[str]


class GapAnalysisOutput(BaseModel):
    """Structured output from the Resume Comparator agent."""

    match_score: int = Field(ge=0, le=100, description="0-100 fit score")
    match_reasoning: str
    strengths: list[str] = Field(description="Top 3 resume matches for this role")
    gaps: list[str] = Field(description="Missing skills or experience")
    suggestions: list[str] = Field(description="Actionable resume improvement steps")


class CoverLetterOutput(BaseModel):
    """Single version of a generated cover letter."""

    version: int
    tone: str = Field(description="One of: professional / conversational / bold")
    text: str
    word_count: int
    generated_at: datetime


# ---------------------------------------------------------------------------
# Interview prep schemas
# ---------------------------------------------------------------------------


class InterviewQuestion(BaseModel):
    """A single interview question with a suggested answer framework."""

    question: str
    category: str = Field(description="e.g. behavioral / technical / situational")
    suggested_framework: str


class InterviewPrepOutput(BaseModel):
    """Structured output from the Interview Prep agent."""

    role_title: str
    company: str
    questions: list[InterviewQuestion]


# ---------------------------------------------------------------------------
# Cover letter refine request
# ---------------------------------------------------------------------------


class CoverLetterRefineRequest(BaseModel):
    """User instruction for iterating on a cover letter."""

    application_id: int
    instruction: str
    tone: str = "professional"


class CoverLetterGenerateRequest(BaseModel):
    """Initial cover letter generation request."""

    application_id: int
    tone: str = "professional"

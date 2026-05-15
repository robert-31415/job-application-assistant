"""JD Analyzer agent.

Accepts a raw job description string, optionally enriches it with Tavily company
research, calls Claude with a structured output prompt, and returns a
JDAnalysisOutput instance.

Phase 2 implementation.
"""

from app.config import settings
from app.models.schemas import JDAnalysisOutput


async def analyze_jd(jd_text: str, company_hint: str = "") -> JDAnalysisOutput:
    """Analyze a job description and return structured extraction.

    Args:
        jd_text: The full raw text of the job description.
        company_hint: Optional company name to seed the Tavily search query.

    Returns:
        JDAnalysisOutput with extracted fields and Tavily-enriched company summary.
    """
    raise NotImplementedError("JD Analyzer agent — Phase 2")

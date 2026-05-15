"""Interview Prep agent.

Generates role-specific interview questions (behavioral, technical, situational)
with suggested answer frameworks, based on the JD analysis output.

Phase 6 implementation.
"""

from app.models.schemas import InterviewPrepOutput, JDAnalysisOutput


async def generate_interview_prep(jd_analysis: JDAnalysisOutput) -> InterviewPrepOutput:
    """Generate likely interview questions and answer frameworks for a specific role.

    Args:
        jd_analysis: Structured output from the JD Analyzer agent.

    Returns:
        InterviewPrepOutput containing categorized questions with suggested frameworks.
    """
    raise NotImplementedError("Interview Prep agent — Phase 6")

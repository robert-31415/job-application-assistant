"""Resume Comparator agent.

Accepts the candidate's full resume text and a structured JDAnalysisOutput,
calls Claude with both in context, and returns a GapAnalysisOutput.

Phase 3 implementation.
"""

from app.models.schemas import GapAnalysisOutput, JDAnalysisOutput


async def compare_resume(resume_text: str, jd_analysis: JDAnalysisOutput) -> GapAnalysisOutput:
    """Run a gap analysis comparing the resume against the analyzed JD.

    Args:
        resume_text: Extracted plain text from the candidate's uploaded resume.
        jd_analysis: Structured output from the JD Analyzer agent.

    Returns:
        GapAnalysisOutput with match score, strengths, gaps, and improvement suggestions.
    """
    raise NotImplementedError("Resume Comparator agent — Phase 3")

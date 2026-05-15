"""Cover Letter Generator agent.

Generates an initial cover letter from resume text + JD analysis, and supports
iterative refinement via a follow-up instruction loop.

Phase 4 implementation.
"""

from app.models.schemas import CoverLetterOutput, JDAnalysisOutput


async def generate_cover_letter(
    resume_text: str,
    jd_analysis: JDAnalysisOutput,
    tone: str = "professional",
    version: int = 1,
) -> CoverLetterOutput:
    """Generate a tailored cover letter using few-shot tone examples.

    Args:
        resume_text: Extracted plain text from the candidate's resume.
        jd_analysis: Structured JD analysis providing role context.
        tone: Desired tone — 'professional', 'conversational', or 'bold'.
        version: Version number to embed in the output (increments on each generation).

    Returns:
        CoverLetterOutput with the letter text, word count, and metadata.
    """
    raise NotImplementedError("Cover Letter Generator agent — Phase 4")


async def refine_cover_letter(
    current_text: str,
    instruction: str,
    tone: str = "professional",
    version: int = 2,
) -> CoverLetterOutput:
    """Iterate on an existing cover letter based on a user instruction.

    Args:
        current_text: The most recent cover letter version text.
        instruction: User-provided refinement direction (e.g. 'make it shorter').
        tone: Desired tone for the refined version.
        version: Version number for this revision.

    Returns:
        Updated CoverLetterOutput.
    """
    raise NotImplementedError("Cover Letter Refinement — Phase 4")

"""Cover Letter Generator agent.

Generates an initial tailored cover letter from resume text, structured JD analysis,
and gap analysis. Supports iterative refinement via a follow-up instruction loop.

Public functions:
  generate_cover_letter — initial generation: Tavily context + Claude → CoverLetterOutput
  refine_cover_letter   — refinement loop: current text + user instruction → CoverLetterOutput
"""

import logging
from datetime import UTC, datetime

import anthropic
from anthropic.types import TextBlock

from app.config import settings
from app.models.schemas import CoverLetterOutput, GapAnalysisOutput, JDAnalysisOutput

logger = logging.getLogger(__name__)

_TONE_GUIDANCE = {
    "professional": (
        "Write in a formal, precise tone. Use complete sentences, avoid contractions, "
        "and maintain a respectful, business-appropriate register throughout."
    ),
    "conversational": (
        "Write in a warm, personable tone. Use natural language and occasional contractions. "
        "Sound like a real person who is genuinely excited about the role."
    ),
    "bold": (
        "Write in a confident, punchy tone. Lead with impact. Use short, declarative sentences. "
        "Avoid hedging language — own every claim."
    ),
}

_GENERATE_SYSTEM_PROMPT = """\
You are an expert cover letter writer. Your task is to write a compelling, tailored \
cover letter based on the candidate's resume, a structured job description analysis, \
and a gap analysis showing how the candidate matches the role.

Structure (3 paragraphs, no headers or labels):
1. Opening — reference something specific about the company from the company_research \
   field (a product, mission, recent achievement, or cultural value). Connect it to \
   why the candidate is applying. Do NOT use generic openers like "I am writing to apply."
2. Body — map the candidate's top 3 strengths (from gap_analysis.strengths) directly \
   to the top 3 required skills (from jd_analysis.required_skills). Be specific and \
   use concrete examples drawn from the resume text.
3. Closing — express genuine enthusiasm, reference the specific role title and company \
   name, and include a clear, confident call to action (e.g. request for an interview).

Constraints:
- Target 250–400 words. Do not exceed 400 words.
- Output the cover letter text only — no subject line, no date, no address block, \
  no salutation, no sign-off. Just the three paragraphs.
- Do not invent facts not present in the provided context.
- Apply the tone guidance provided below exactly.
"""

_REFINE_SYSTEM_PROMPT = """\
You are an expert cover letter editor. You will be given a cover letter and a specific \
instruction from the candidate on how to improve it.

Rules:
- Apply the instruction faithfully and completely.
- Preserve the company name and role title from the existing letter — do not invent \
  or change them.
- Maintain the 3-paragraph structure (opening / body / closing).
- Keep the output within 250–400 words.
- Output the revised cover letter text only — no labels, no commentary, no sign-off.
- Apply the tone guidance provided below exactly.
"""


def _build_generate_user_message(
    resume_text: str,
    jd_analysis: JDAnalysisOutput,
    gap_analysis: GapAnalysisOutput,
    tone: str,
) -> str:
    tone_instruction = _TONE_GUIDANCE.get(tone, _TONE_GUIDANCE["professional"])
    top_skills = ", ".join(jd_analysis.required_skills[:3])
    top_strengths = "\n".join(f"- {s}" for s in gap_analysis.strengths[:3])

    return (
        f"## Tone instruction\n{tone_instruction}\n\n"
        f"## Candidate Resume\n\n{resume_text}\n\n"
        f"## Company Research\n\n{jd_analysis.company_research}\n\n"
        f"## Role\n\n{jd_analysis.role_title} at {jd_analysis.company}\n\n"
        f"## Top 3 Required Skills\n\n{top_skills}\n\n"
        f"## Candidate's Top 3 Strengths (from gap analysis)\n\n{top_strengths}\n\n"
        f"## Full JD Analysis\n\n{jd_analysis.model_dump_json(indent=2)}"
    )


def _build_refine_user_message(
    current_text: str,
    instruction: str,
    tone: str,
) -> str:
    tone_instruction = _TONE_GUIDANCE.get(tone, _TONE_GUIDANCE["professional"])
    return (
        f"## Tone instruction\n{tone_instruction}\n\n"
        f"## Current cover letter\n\n{current_text}\n\n"
        f"## Refinement instruction\n\n{instruction}"
    )


async def generate_cover_letter(
    resume_text: str,
    jd_analysis: JDAnalysisOutput,
    gap_analysis: GapAnalysisOutput,
    tone: str,
    version: int,
) -> CoverLetterOutput:
    """Generate a tailored cover letter using resume text, JD analysis, and gap analysis.

    Args:
        resume_text: Extracted plain text from the candidate's uploaded resume.
        jd_analysis: Structured output from the JD Analyzer agent.
        gap_analysis: Structured output from the Resume Comparator agent.
        tone: Desired tone — 'professional', 'conversational', or 'bold'.
        version: Version number to embed in the output.

    Returns:
        CoverLetterOutput with the letter text, word count, tone, and version metadata.

    Raises:
        anthropic.APIError: On Claude API failures.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_message = _build_generate_user_message(resume_text, jd_analysis, gap_analysis, tone)

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        system=_GENERATE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(block.text for block in message.content if isinstance(block, TextBlock))
    letter_text = text.strip()

    logger.info(
        "Cover letter generated — version %d, tone: %s, words: %d, model: %s",
        version,
        tone,
        len(letter_text.split()),
        settings.claude_model,
    )

    return CoverLetterOutput(
        version=version,
        tone=tone,
        text=letter_text,
        word_count=len(letter_text.split()),
        generated_at=datetime.now(UTC),
    )


async def refine_cover_letter(
    current_text: str,
    instruction: str,
    tone: str,
    version: int,
) -> CoverLetterOutput:
    """Iterate on an existing cover letter based on a user instruction.

    Args:
        current_text: The most recent cover letter version text.
        instruction: User-provided refinement direction (e.g. 'make it shorter').
        tone: Desired tone for the refined version.
        version: Version number for this revision.

    Returns:
        Updated CoverLetterOutput with incremented version.

    Raises:
        anthropic.APIError: On Claude API failures.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_message = _build_refine_user_message(current_text, instruction, tone)

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        system=_REFINE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(block.text for block in message.content if isinstance(block, TextBlock))
    letter_text = text.strip()

    logger.info(
        "Cover letter refined — version %d, tone: %s, words: %d, model: %s",
        version,
        tone,
        len(letter_text.split()),
        settings.claude_model,
    )

    return CoverLetterOutput(
        version=version,
        tone=tone,
        text=letter_text,
        word_count=len(letter_text.split()),
        generated_at=datetime.now(UTC),
    )

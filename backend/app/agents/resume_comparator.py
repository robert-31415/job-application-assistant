"""Resume Comparator agent.

Accepts the candidate's full resume text, the structured JDAnalysisOutput, and the
raw JD text, then calls Claude to produce a GapAnalysisOutput containing a match
score, strengths, gaps, and improvement suggestions.

The model name is always pulled from config.settings — never hardcoded.
"""

import json
import logging

import anthropic
from anthropic.types import TextBlock

from app.config import settings
from app.models.schemas import GapAnalysisOutput, JDAnalysisOutput

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are an expert technical recruiter and career coach performing a resume-to-job \
description gap analysis.

You MUST respond with a single valid JSON object matching this exact schema \
(no markdown fences, no preamble, no trailing text):

{
  "match_score": integer 0-100,
  "match_reasoning": "string — 2-4 sentence explanation of the score",
  "strengths": ["string", ...],
  "gaps": ["string", ...],
  "suggestions": ["string", ...]
}

Scoring rubric (apply strictly):
  0–49   Does not meet minimum requirements — critical required skills or experience missing
  50–74  Meets minimum requirements — has the basics but noticeable gaps remain
  75–89  Strong match — meets most requirements with only minor gaps
  90–100 Exceptional match — meets or exceeds virtually all requirements

Field rules:
- match_score: integer, must respect the rubric above
- match_reasoning: honest, specific explanation referencing actual content from the resume
  and JD — do not write generic platitudes
- strengths: exactly 3 items, each a specific qualification from the resume that matches
  a requirement in the JD; quote or paraphrase the resume directly
- gaps: list every required skill or experience clearly absent from the resume;
  include at least 1 item even for strong matches — no resume is perfect; omit
  nice-to-have skills that are merely absent
- suggestions: 3–5 concrete, actionable steps the candidate can take to improve their
  resume specifically for this role (e.g. "Add a quantified achievement for X",
  "Include a project demonstrating Y") — not generic advice
"""


def _build_user_message(
    resume_text: str,
    jd_analysis: JDAnalysisOutput,
    jd_raw: str,
) -> str:
    """Compose the user turn with all three context sources for Claude."""
    return (
        f"## Candidate Resume\n\n{resume_text}\n\n"
        f"## Job Description (raw)\n\n{jd_raw}\n\n"
        f"## Job Description (structured analysis)\n\n"
        f"{jd_analysis.model_dump_json(indent=2)}"
    )


async def compare_resume(
    resume_text: str,
    jd_analysis: JDAnalysisOutput,
    jd_raw: str,
) -> GapAnalysisOutput:
    """Run a gap analysis comparing the resume against the analyzed JD.

    Sends the full resume text, structured JD analysis, and raw JD text to Claude
    with a strict JSON output prompt and parses the response into a GapAnalysisOutput.

    Args:
        resume_text: Extracted plain text from the candidate's uploaded resume.
        jd_analysis: Structured output from the JD Analyzer agent.
        jd_raw: The original raw job description text for additional context.

    Returns:
        GapAnalysisOutput with match_score, match_reasoning, strengths, gaps,
        and actionable suggestions.

    Raises:
        ValueError: If Claude returns malformed JSON.
        anthropic.APIError: On Claude API failures.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_message = _build_user_message(resume_text, jd_analysis, jd_raw)

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(block.text for block in message.content if isinstance(block, TextBlock))
    raw_text = text.strip()
    logger.debug("Resume comparator raw response (first 200 chars): %s", raw_text[:200])

    # Strip accidental markdown fences if Claude adds them despite instructions
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        raw_text = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()

    try:
        output = GapAnalysisOutput.model_validate_json(raw_text)
    except Exception as exc:
        try:
            output = GapAnalysisOutput.model_validate(json.loads(raw_text))
        except Exception:
            logger.error(
                "Failed to parse resume comparator response: %s", raw_text[:500]
            )
            raise ValueError(f"Claude returned unparseable JSON: {exc}") from exc

    logger.info(
        "Gap analysis complete — score: %d, strengths: %d, gaps: %d, model: %s",
        output.match_score,
        len(output.strengths),
        len(output.gaps),
        settings.claude_model,
    )
    return output

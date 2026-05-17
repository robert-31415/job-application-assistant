"""Interview Prep agent.

Generates exactly 10 role-specific interview questions with suggested answer
frameworks, based on the JD analysis and gap analysis outputs.

Question breakdown:
  4 behavioral   — STAR format, drawn from the candidate's profile and role requirements
  3 technical    — tied directly to jd_analysis.required_skills
  2 situational  — hypothetical workplace scenarios relevant to the seniority level
  1 culture fit  — based on company_research and the team context
"""

import json
import logging

import anthropic
from anthropic.types import TextBlock

from app.config import settings
from app.models.schemas import GapAnalysisOutput, InterviewPrepOutput, JDAnalysisOutput

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are an expert technical recruiter preparing a candidate for a job interview.

Generate exactly 10 interview questions for the role described below.

Breakdown (must follow exactly):
  - 4 behavioral questions — use STAR format prompts (Situation, Task, Action, Result);
    draw on the candidate's background from the gap analysis
  - 3 technical questions — tied directly to the required skills listed in the JD analysis;
    vary difficulty (one introductory, one mid-level, one advanced)
  - 2 situational questions — hypothetical workplace scenarios appropriate to the seniority level
  - 1 culture-fit question — reference the company research to make it specific

For each question provide:
  - question: the full question text
  - category: exactly one of "behavioral", "technical", "situational", "culture_fit"
  - suggested_framework: 2-4 sentences describing how to structure a strong answer
    (e.g. STAR steps for behavioral, key concepts to cover for technical)

You MUST respond with a single valid JSON object — no markdown fences, no preamble:

{
  "role_title": "<role title from the JD>",
  "company": "<company name from the JD>",
  "questions": [
    {
      "question": "...",
      "category": "behavioral",
      "suggested_framework": "..."
    }
  ]
}

Return exactly 10 items in the questions array.
"""


def _build_user_message(
    jd_analysis: JDAnalysisOutput,
    gap_analysis: GapAnalysisOutput,
) -> str:
    top_strengths = "\n".join(f"- {s}" for s in gap_analysis.strengths)
    gaps = "\n".join(f"- {g}" for g in gap_analysis.gaps)
    required_skills = ", ".join(jd_analysis.required_skills)

    return (
        f"## Role\n\n{jd_analysis.role_title} at {jd_analysis.company}\n\n"
        f"## Required Skills\n\n{required_skills}\n\n"
        f"## Company Research\n\n{jd_analysis.company_research}\n\n"
        f"## Seniority Level\n\n{jd_analysis.seniority_level}\n\n"
        f"## Candidate Strengths\n\n{top_strengths}\n\n"
        f"## Candidate Gaps\n\n{gaps}\n\n"
        f"## Full JD Analysis\n\n{jd_analysis.model_dump_json(indent=2)}"
    )


async def generate_interview_questions(
    jd_analysis: JDAnalysisOutput,
    gap_analysis: GapAnalysisOutput,
) -> InterviewPrepOutput:
    """Generate 10 interview questions with answer frameworks for the given role.

    Args:
        jd_analysis: Structured output from the JD Analyzer agent.
        gap_analysis: Structured output from the Resume Comparator agent.

    Returns:
        InterviewPrepOutput with role_title, company, and exactly 10 questions.

    Raises:
        ValueError: If Claude returns malformed JSON or wrong question count.
        anthropic.APIError: On Claude API failures.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_message = _build_user_message(jd_analysis, gap_analysis)

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(block.text for block in message.content if isinstance(block, TextBlock))
    raw_text = text.strip()

    # Strip accidental markdown fences as a defensive fallback
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        raw_text = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()

    try:
        output = InterviewPrepOutput.model_validate_json(raw_text)
    except Exception as exc:
        try:
            output = InterviewPrepOutput.model_validate(json.loads(raw_text))
        except Exception:
            logger.error("Failed to parse interview prep response: %s", raw_text[:500])
            raise ValueError(f"Claude returned unparseable JSON: {exc}") from exc

    logger.info(
        "Interview prep generated — role: '%s', company: '%s', questions: %d, model: %s",
        output.role_title,
        output.company,
        len(output.questions),
        settings.claude_model,
    )
    return output

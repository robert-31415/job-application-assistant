"""JD Analyzer agent.

Accepts a raw job description string, enriches it with live Tavily company
research, calls Claude with a structured-output prompt, and returns a
validated JDAnalysisOutput instance.

The model name is always pulled from config.settings — never hardcoded.

Public exports used by both the batch endpoint and the streaming endpoint:
  SYSTEM_PROMPT        — the system prompt string fed to every Claude call
  build_user_message   — combines JD text + Tavily snippets into the user turn
  get_tavily_snippets  — async helper that fetches company snippets (soft failure)
  analyze_jd           — full batch call: Tavily → Claude → parsed JDAnalysisOutput
"""

import json
import logging

import anthropic
from anthropic.types import TextBlock
from tavily import TavilyClient

from app.config import settings
from app.models.schemas import JDAnalysisOutput

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a job description analyst. Your task is to extract structured information
from a job description and company research.

You MUST respond with a single valid JSON object that matches this exact schema
(no markdown fences, no preamble, no trailing text):

{
  "role_title": "string",
  "company": "string",
  "required_skills": ["string", ...],
  "nice_to_have_skills": ["string", ...],
  "seniority_level": "junior|mid|senior|staff|exec",
  "location": "string",
  "salary_hint": "string or null",
  "company_research": "string — 2-4 sentence summary from the web research",
  "key_responsibilities": ["string", ...]
}

Rules:
- required_skills: hard requirements explicitly stated in the JD
- nice_to_have_skills: preferred/bonus skills, or empty list if none
- seniority_level: infer from title and years of experience if not explicit
- salary_hint: null if not mentioned
- company_research: synthesise the provided web snippets into a readable summary;
  if no snippets were provided write "No public information found."
- key_responsibilities: top 5–7 bullet points from the JD, paraphrased concisely
"""


def build_user_message(jd_raw: str, company_snippets: list[str]) -> str:
    """Compose the user turn combining the JD text with Tavily search snippets."""
    snippets_block = (
        "\n\n".join(f"[Snippet {i + 1}]\n{s}" for i, s in enumerate(company_snippets))
        if company_snippets
        else "No web research results available."
    )
    return (
        f"## Job Description\n\n{jd_raw}\n\n"
        f"## Company Web Research\n\n{snippets_block}"
    )


async def get_tavily_snippets(company_hint: str) -> list[str]:
    """Fetch up to 3 Tavily web snippets for a company name.

    Failures are handled gracefully — returns an empty list rather than raising,
    so callers can always proceed to the Claude call even if Tavily is unavailable.

    Args:
        company_hint: Company name to search for. Returns [] immediately if empty.

    Returns:
        List of content strings from the top Tavily search results.
    """
    if not company_hint:
        return []
    try:
        tavily = TavilyClient(api_key=settings.tavily_api_key)
        results = tavily.search(
            query=f"{company_hint} company culture engineering team",
            max_results=3,
        )
        snippets = [
            r["content"] for r in results.get("results", []) if r.get("content")
        ]
        logger.info("Tavily returned %d snippets for '%s'", len(snippets), company_hint)
        return snippets
    except Exception:
        logger.warning(
            "Tavily search failed for '%s'; continuing without it",
            company_hint,
            exc_info=True,
        )
        return []


async def analyze_jd(jd_raw: str, company_hint: str) -> JDAnalysisOutput:
    """Analyze a job description and return structured extraction.

    1. Calls Tavily to fetch live company context.
    2. Sends the JD + context to Claude with a strict JSON output prompt.
    3. Parses the response into a validated JDAnalysisOutput.

    Args:
        jd_raw: The full raw text of the job description.
        company_hint: Company name used to seed the Tavily search query.

    Returns:
        JDAnalysisOutput with all fields populated.

    Raises:
        ValueError: If Claude returns malformed JSON.
        anthropic.APIError: On Claude API failures.
    """
    company_snippets = await get_tavily_snippets(company_hint)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_message = build_user_message(jd_raw, company_snippets)

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = next(block.text for block in message.content if isinstance(block, TextBlock))
    raw_text = text.strip()
    logger.debug("Claude raw response (first 200 chars): %s", raw_text[:200])

    # Strip accidental markdown fences if Claude adds them despite instructions
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        raw_text = "\n".join(
            line for line in lines if not line.strip().startswith("```")
        ).strip()

    try:
        output = JDAnalysisOutput.model_validate_json(raw_text)
    except Exception as exc:
        # Attempt lenient fallback via json.loads for minor whitespace issues
        try:
            output = JDAnalysisOutput.model_validate(json.loads(raw_text))
        except Exception:
            logger.error("Failed to parse Claude JD analysis response: %s", raw_text[:500])
            raise ValueError(f"Claude returned unparseable JSON: {exc}") from exc

    logger.info(
        "JD analysis complete — role: '%s', company: '%s', model: %s",
        output.role_title,
        output.company,
        settings.claude_model,
    )
    return output

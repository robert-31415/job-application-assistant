# Agentic Job Application Assistant — Claude Code Context

## Project Overview

A full-stack portfolio project that orchestrates multiple AI agents to analyze job
descriptions, compare them against a candidate's resume, generate tailored cover
letters, score application fit, and track applications on a Kanban board.

**Goal:** demonstrate multi-agent AI engineering, full-stack development, and
production-quality code for employer review on GitHub.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, TailwindCSS 3, React Query 5, React Router 6 |
| Backend | Python 3.11, FastAPI 0.111, SQLAlchemy 2 (async), SQLite / aiosqlite |
| AI | Anthropic SDK — `claude-sonnet-4-6` |
| Search | Tavily Python client |
| File parsing | PyMuPDF (PDF), python-docx (DOCX) |
| Export | python-docx |
| Infra | Docker Compose, GitHub Actions CI |

---

## Folder Structure

```
job-application-assistant/
├── .github/workflows/ci.yml     # CI — lint, test, build
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # pydantic-settings (env vars)
│   │   ├── database.py          # async SQLAlchemy engine + init_db
│   │   ├── models/
│   │   │   ├── db.py            # SQLAlchemy ORM (Resume, Application)
│   │   │   └── schemas.py       # Pydantic agent I/O + API schemas
│   │   ├── routers/
│   │   │   ├── resume.py        # POST /api/resume/upload, GET /current ✅
│   │   │   ├── analyze.py       # POST /api/analyze/jd (Phase 2)
│   │   │   ├── compare.py       # POST /api/compare/resume (Phase 3)
│   │   │   ├── cover_letter.py  # POST /api/cover-letter/* (Phase 4)
│   │   │   ├── applications.py  # CRUD /api/applications ✅
│   │   │   ├── export.py        # GET /api/export/* (Phase 6)
│   │   │   └── interview_prep.py# POST /api/interview-prep/* (Phase 6)
│   │   └── agents/
│   │       ├── jd_analyzer.py        # Phase 2
│   │       ├── resume_comparator.py  # Phase 3
│   │       ├── cover_letter.py       # Phase 4
│   │       └── interview_prep.py     # Phase 6
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx             # React entry + QueryClientProvider
│   │   ├── App.jsx              # Router + sidebar layout
│   │   ├── api/client.js        # Axios instance + all API functions
│   │   ├── components/          # ResumeUpload ✅, others are placeholders
│   │   ├── pages/               # Dashboard ✅, Analyze, Applications, Export
│   │   └── hooks/               # useResume ✅, useApplications ✅
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── data/                        # SQLite DB volume (git-ignored)
├── docker-compose.yml
├── .env                         # ANTHROPIC_API_KEY, TAVILY_API_KEY
└── CLAUDE.md
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `TAVILY_API_KEY` | Yes | — | Tavily web search key |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./data/app.db` | SQLite path |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` | Model override |
| `MAX_TOKENS` | No | `4096` | Max tokens per agent call |
| `BACKEND_CORS_ORIGINS` | No | `["http://localhost:5173"]` | Allowed CORS origins |

---

## How to Run Locally

### Option 1 — Docker Compose (recommended)

```bash
cp .env.example .env   # fill in API keys
docker compose up
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

### Option 2 — Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Running Tests

```bash
# Backend
cd backend && pytest tests/ -v

# Frontend
cd frontend && npm run test
```

---

## API Endpoints

| Method | Path | Status |
|---|---|---|
| POST | `/api/resume/upload` | ✅ Phase 1 |
| GET | `/api/resume/current` | ✅ Phase 1 |
| GET/POST/PATCH/DELETE | `/api/applications` | ✅ Phase 1 |
| POST | `/api/analyze/jd` | ✅ Phase 2 |
| POST | `/api/compare/resume` | ✅ Phase 3 |
| POST | `/api/cover-letter/generate` | Phase 4 |
| POST | `/api/cover-letter/refine` | Phase 4 |
| POST | `/api/interview-prep/generate` | Phase 6 |
| GET | `/api/export/cover-letter/{id}` | Phase 6 |
| GET | `/api/export/interview-prep/{id}` | Phase 6 |

---

## Current Phase Status

| Phase | Description | Status |
|---|---|---|
| 1 | Scaffold, database, resume upload | ✅ Complete |
| 2 | JD Analysis Agent + Tavily | ✅ Complete |
| 3 | Resume Comparison Agent | ✅ Complete |
| 4 | Cover Letter Generator | ✅ Complete |
| 5 | Kanban Application Tracker | Pending |
| 6 | Export, Interview Prep, README | Pending |

---

## Environment & Configuration Notes

- **`.env` location:** the `.env` file must live inside `backend/`, not the repo root. `pydantic-settings` resolves `.env` relative to the process working directory, and uvicorn runs from `backend/`.
- **`data/` directory:** must be created manually before the first uvicorn start — it is git-ignored and not auto-created on boot:
  ```bash
  mkdir -p backend/data
  ```
- **SQLite path:** the database file is at `backend/data/app.db`. A stray empty `data/app.db` at the repo root is an artefact from running uvicorn from the wrong directory — delete it if it appears.
- **Starting uvicorn:** always run from inside `backend/`:
  ```bash
  cd backend && uvicorn app.main:app --reload --port 8000
  ```
  Never run uvicorn from the repo root — the app module and `.env` will not resolve correctly.

---

## CI Configuration Notes

- **`backend/app/config.py`:** the `Settings()` instantiation line carries `# type: ignore[call-arg]` to suppress a mypy false positive caused by pydantic-settings' dynamic field population.
- **Frontend test script:** `vitest run --passWithNoTests` in `package.json` so CI passes before any frontend tests are written.
- **Backend test pattern — required for all new test files:**
  `backend/tests/test_resume.py` establishes the canonical pattern:
  1. Create a separate `TEST_DATABASE_URL` pointing at `data/test.db`.
  2. Use a `pytest_asyncio` fixture with `autouse=True` that calls `Base.metadata.create_all` before each test and `Base.metadata.drop_all` after.
  3. Override `app.dependency_overrides[get_db]` with a function that uses the test session.
  4. Clear overrides in the fixture teardown.
  All future test files must follow this pattern — never share state with the dev database.
- **Ruff E402:** all imports must appear before any executable module-level code. In test files, `os.makedirs(...)` calls belong inside fixtures, not at module level.
- **Anthropic SDK mock pattern — required for all agent tests:** When mocking `anthropic.AsyncAnthropic.messages.create`, the response content must use real `TextBlock` instances, not `MagicMock` objects. The agents filter `response.content` with `isinstance(block, TextBlock)`, so plain mocks fail the check and raise `StopIteration`. Always construct the mock response as a real `Message` object:
  ```python
  from anthropic.types import TextBlock, Message, Usage
  mock_response = Message(
      id="msg_test", type="message", role="assistant",
      content=[TextBlock(type="text", text=json.dumps({...}))],
      model="claude-sonnet-4-6", stop_reason="end_turn",
      stop_sequence=None, usage=Usage(input_tokens=10, output_tokens=50),
  )
  ```

---

## iTerm Tab Layout

Three persistent tabs for local development — don't mix commands between them:

| Tab | Directory | Process |
|---|---|---|
| Tab 1 | `backend/` | `uvicorn app.main:app --reload --port 8000` — leave running |
| Tab 2 | `frontend/` | `npm run dev` — leave running |
| Tab 3 | repo root | all `git`, `sqlite3`, and `curl` commands run here |

---

## Key Conventions

- All agent calls go through the FastAPI backend — no direct Claude calls from the frontend.
- Agents accept Pydantic models as input and return Pydantic models as output.
- SQLite data is persisted in `./data/app.db` (mounted as a Docker volume).
- **`POST /api/analyze/jd`** returns a single JSON `JDAnalysisOutput` and persists `jd_analysis_json` to the database. This is the source of truth for persistence.
- **`GET /api/analyze/jd/stream?application_id={id}`** streams the same Claude call token-by-token as Server-Sent Events. Each event is `data: {token}\n\n`; the final event is `data: [DONE]\n\n`. This endpoint is **read-only** — it never writes to the database. The frontend consumes it with the Fetch API `ReadableStream`.
- `SYSTEM_PROMPT`, `build_user_message`, and `get_tavily_snippets` are exported from `agents/jd_analyzer.py` so both the batch and streaming endpoints share the same prompt and Tavily logic without duplication.
- Model default is `claude-sonnet-4-6`. Override with `CLAUDE_MODEL` env var.
- The Analyze page creates an Application record first (`POST /api/applications`), then passes the resulting `application_id` to `POST /api/analyze/jd`. The agent reads `jd_raw` and `company` from the database row — it does not accept them inline.
- **`POST /api/compare/resume`** requires the application to already have a non-null `jd_analysis_json` (run `/api/analyze/jd` first). It loads the most recently uploaded resume from the `resumes` table and returns a `GapAnalysisOutput`, persisting `match_score` and `gap_analysis_json` to the application row.
- **Match score rubric** (applied by the Resume Comparator agent):
  - 0–49: Does not meet minimum requirements
  - 50–74: Meets minimum requirements
  - 75–89: Strong match
  - 90–100: Exceptional match
- **Cover letter version storage format:** `cover_letter_versions_json` is a JSON array of serialised `CoverLetterOutput` objects, ordered oldest to newest. Each generate or refine call appends one entry. `cover_letter_text` always holds the most recent version's text. Example array entry:
  ```json
  {"version": 1, "tone": "professional", "text": "...", "word_count": 312, "generated_at": "2026-05-16T10:00:00"}
  ```
- **`POST /api/cover-letter/generate`** requires `jd_analysis_json` and `gap_analysis_json` to be non-null (run `/api/analyze/jd` and `/api/compare/resume` first) and at least one uploaded resume. Tone options: `professional`, `conversational`, `bold`.
- **`POST /api/cover-letter/refine`** requires `cover_letter_text` to be non-null (run generate first). Sends current text + user instruction to Claude; preserves company name and role title.
- **Cover letter agent exports:** `generate_cover_letter(resume_text, jd_analysis, gap_analysis, tone, version)` and `refine_cover_letter(current_text, instruction, tone, version)` in `agents/cover_letter.py`.
- **docx npm package** is installed in the frontend and used by `CoverLetter.jsx` to produce `.docx` downloads via `Packer.toBlob()`.

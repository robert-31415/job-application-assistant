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
| 5 | Kanban Application Tracker | ✅ Complete |
| 6 | Export, Interview Prep, README | ✅ Complete |

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
- **Kanban drag-and-drop:** `@hello-pangea/dnd` (already in `package.json` from Phase 1) powers the Kanban board. `DragDropContext` wraps the board; each column is a `Droppable`; each card is a `Draggable`. Drag-end fires `PATCH /api/applications/{id}` with the new status value.
- **Kanban column-to-status mapping** (display label → API value):
  - Saved → `saved`, Applied → `applied`, Phone Screen → `screen`, Interview → `interview`, Offer → `offer`, Rejected → `rejected`
- **Kanban component architecture:** `components/KanbanBoard.jsx` contains the DnD board logic and is used by both `pages/Applications.jsx` (route `/applications`) and `pages/KanbanBoard.jsx` (route `/kanban`). `components/KanbanCard.jsx` renders each card with notes/delete. `components/ApplicationDrawer.jsx` is the right-side detail drawer. `components/AddApplicationModal.jsx` creates an application then navigates to `/analyze` with `state: { applicationId }`.
- **Analyze page pre-population:** when navigated to with `state.applicationId` (from `AddApplicationModal`), `Analyze.jsx` loads the application via `listApplications()`, pre-fills the form, and skips `createApplication` on submit since the record already exists.
- **Interview Prep agent:** `agents/interview_prep.py` exports `generate_interview_questions(jd_analysis, gap_analysis) -> InterviewPrepOutput`. Generates exactly 10 questions: 4 behavioral (STAR), 3 technical (tied to required_skills), 2 situational, 1 culture fit. Each question has `question`, `category`, and `suggested_framework`.
- **Export endpoints:** `GET /api/export/cover-letter/{id}` and `GET /api/export/interview-prep/{id}` return DOCX files via `StreamingResponse`. The interview-prep export reads from persisted `interview_prep_json` — no Claude API call at download time. python-docx builds the documents in memory (`io.BytesIO`) — no temp files written to disk.
- **Export client functions:** `exportCoverLetter(id)` and `exportInterviewPrep(id)` in `api/client.js` use `responseType: 'blob'`, create an object URL, and click a temporary `<a>` element to trigger the browser download.

---

## Known Limitations

- **SQLite is not production-grade** — suitable for single-user local development only; concurrent writes will serialize and large datasets will degrade performance.
- **No authentication layer** — the API has no auth; anyone who can reach port 8000 can read and write all data.
- **Single-user only** — resumes and applications are stored globally; there is no concept of user accounts or data isolation.
- **`interview_prep_json` column added without Alembic** — no migration exists; if the DB is recreated the column must be re-added manually: `sqlite3 backend/data/app.db "ALTER TABLE applications ADD COLUMN interview_prep_json TEXT;"`
- **Cover letter export always downloads the latest version** — version-specific export is not supported; the DOCX always reflects `cover_letter_text` (the most recent refinement).
- **Interview prep export requires prior generation** — `GET /api/export/interview-prep/{id}` reads from persisted `interview_prep_json`; the download button is disabled until the prep sheet has been generated at least once.

---

## Future Enhancements

- **Multi-user support** — add JWT auth, user accounts, and row-level data isolation.
- **PostgreSQL migration** — swap SQLite for PostgreSQL for production use; SQLAlchemy's async engine makes this a config-only change.
- **Resume versioning** — track multiple resume versions and allow per-application resume selection.
- **Email application tracking** — auto-ingest application confirmation emails via a Gmail/Outlook connector to update Kanban status automatically.
- **Alembic migrations** — replace manual `ALTER TABLE` statements with Alembic so schema changes are tracked, versioned, and reproducible.
- **Version-specific cover letter export** — allow the user to select any version from the history sidebar and download that specific version as DOCX.
- **Export page enhancements** — show the cover letter version number and generation date alongside the download button so the user knows exactly what they are downloading.

---

## Post-Loop Bug Fixes

Bugs discovered and fixed after the main development loops completed:

- **`applicationId` null in `Analyze.jsx` after JD analysis** — `setApplicationId(null)` at the top of `handleSubmit` reset state unconditionally, and `setApplicationId(appId)` was only called inside the `if (!appId)` branch (new applications). For pre-loaded applications navigated from Kanban, `applicationId` stayed null after analysis, breaking "Compare with My Resume". Fixed by calling `setApplicationId(appId)` unconditionally after `setAnalysis(result)`.

- **Cover Letter page not restoring existing versions on application select** — switching application in the dropdown cleared `versions` and `activeVersion` to empty/null and never reloaded persisted data. Fixed by adding a `useEffect` on `selectedAppId` that calls `getApplication(id)` and, if `cover_letter_versions_json` is non-null, parses it and restores `versions` and `activeVersion` to the last entry.

- **Interview Prep page not restoring persisted questions on application select** — same pattern: selecting an application only showed a generate button, ignoring any previously generated questions stored in `interview_prep_json`. Fixed by adding a `useEffect` on `selectedAppId` that calls `getApplication(id)` and, if `interview_prep_json` is non-null, parses and sets `prepData` directly.

- **Interview prep export regenerated questions on every download** — `GET /api/export/interview-prep/{id}` called `generate_interview_questions(...)` live, adding a 30-second Claude API call to every download. Fixed by loading `interview_prep_json` from the application row and parsing with `InterviewPrepOutput.model_validate_json()`. Returns 404 if `interview_prep_json` is null.

- **Export page was a placeholder** — `pages/Export.jsx` contained only a static "implemented in Phase 6" message. Built as a functional export hub with an application selector dropdown, per-document status indicators (green checkmark / grey dash), and download buttons that disable when content has not yet been generated.

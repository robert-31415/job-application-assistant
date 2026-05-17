# Agentic Job Application Assistant

A full-stack portfolio project that orchestrates multiple AI agents to help candidates
analyze job descriptions, compare them against their resume, generate tailored cover
letters, score application fit, and track applications through a Kanban pipeline.

Built to demonstrate multi-agent AI engineering, production-quality FastAPI backend
design, and modern React frontend development — all wired together with Anthropic's
Claude and Tavily web search.

---

## Features

| Phase | Feature | Description |
|---|---|---|
| 1 | Resume Upload | Upload PDF or DOCX resume; extract and store plain text |
| 2 | JD Analysis Agent | Paste a job description → Claude extracts skills, responsibilities, seniority, salary hint, and enriches with live Tavily company research |
| 3 | Resume Comparison Agent | Gap analysis scoring (0–100) with strengths, gaps, and actionable improvement suggestions |
| 4 | Cover Letter Generator | Generate a 3-paragraph tailored cover letter in professional / conversational / bold tone; iterative refinement loop; version history |
| 5 | Kanban Application Tracker | Drag-and-drop pipeline (Saved → Applied → Phone Screen → Interview → Offer → Rejected); inline notes; application detail drawer |
| 6 | Export & Interview Prep | Unified Export page with application selector and status indicators; download cover letter and interview prep sheet as DOCX; generate 10 role-specific questions with answer frameworks |

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
| Drag-and-drop | @hello-pangea/dnd |
| Infra | Docker Compose, GitHub Actions CI |

---

## Quick Start

### Option 1 — Docker Compose (recommended)

```bash
git clone <repo-url>
cd job-application-assistant
cp .env.example .env   # add ANTHROPIC_API_KEY and TAVILY_API_KEY
docker compose up
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

### Option 2 — Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
mkdir -p data
cp .env.example .env   # fill in API keys
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

> **Note:** The `.env` file must live inside `backend/`. The `data/` directory must
> be created manually before first run — it is git-ignored.
>
> **Schema note:** the `interview_prep_json` column was added after the initial schema
> was created. If you are starting from an existing database, add it manually:
> ```bash
> sqlite3 backend/data/app.db "ALTER TABLE applications ADD COLUMN interview_prep_json TEXT;"
> ```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Analyze │ Kanban │ Cover Letter │ Interview Prep │ Export│
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────────┐
│                   FastAPI Backend                        │
│  /api/resume    /api/analyze   /api/compare             │
│  /api/cover-letter   /api/interview-prep  /api/export   │
│  /api/applications                                      │
└──────┬───────────────┬──────────────────┬───────────────┘
       │               │                  │
┌──────▼──────┐ ┌──────▼──────┐  ┌───────▼──────┐
│ JD Analyzer │ │   Resume    │  │  Cover Letter │
│   Agent     │ │ Comparator  │  │   Agent       │
└──────┬──────┘ └──────┬──────┘  └───────┬───────┘
       │               │                  │
┌──────▼───────────────▼──────────────────▼───────┐
│          Anthropic Claude (claude-sonnet-4-6)    │
│          Tavily Web Search (JD analysis only)    │
└──────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────┐
│            SQLite Database (data/app.db)         │
│  resumes  │  applications                        │
│           │  jd_analysis_json, gap_analysis_json  │
│           │  cover_letter_text, interview_prep_json│
└─────────────────────────────────────────────────┘
```

---

## Folder Structure

```
job-application-assistant/
├── .github/workflows/ci.yml  # lint, test, build
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config.py          # pydantic-settings
│   │   ├── database.py        # async SQLAlchemy engine
│   │   ├── models/            # ORM + Pydantic schemas
│   │   ├── routers/           # one file per endpoint group
│   │   └── agents/            # AI agent logic
│   ├── tests/                 # pytest async test suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/             # one file per route
│   │   ├── components/        # shared UI components
│   │   ├── hooks/             # React Query hooks
│   │   ├── api/client.js      # Axios API client
│   │   └── constants/         # shared constants
│   └── package.json
├── docker-compose.yml
└── .env.example
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `TAVILY_API_KEY` | Yes | — | Tavily web search key |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./data/app.db` | Database path |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` | Model override |
| `MAX_TOKENS` | No | `4096` | Max tokens per agent call |
| `BACKEND_CORS_ORIGINS` | No | `["http://localhost:5173"]` | Allowed CORS origins |

---

## Development Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Project scaffold, SQLite schema, resume upload endpoint | ✅ Complete |
| 2 | JD Analysis Agent: Tavily + Claude structured extraction | ✅ Complete |
| 3 | Resume Comparison Agent: gap scoring 0–100 with rubric | ✅ Complete |
| 4 | Cover Letter Generator: tone control, refinement loop, version history | ✅ Complete |
| 5 | Kanban Application Tracker: drag-and-drop pipeline | ✅ Complete |
| 6 | Export (DOCX), Interview Prep Agent, README | ✅ Complete |

---

## Running Tests

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npm run test
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

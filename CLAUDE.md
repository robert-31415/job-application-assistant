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
| POST | `/api/analyze/jd` | Phase 2 |
| POST | `/api/compare/resume` | Phase 3 |
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
| 2 | JD Analysis Agent + Tavily | Pending |
| 3 | Resume Comparison Agent | Pending |
| 4 | Cover Letter Generator | Pending |
| 5 | Kanban Application Tracker | Pending |
| 6 | Export, Interview Prep, README | Pending |

---

## Key Conventions

- All agent calls go through the FastAPI backend — no direct Claude calls from the frontend.
- Agents accept Pydantic models as input and return Pydantic models as output.
- SQLite data is persisted in `./data/app.db` (mounted as a Docker volume).
- Streaming endpoints use Server-Sent Events (SSE); the frontend consumes them with the Fetch API `ReadableStream`.
- Model default is `claude-sonnet-4-6`. Override with `CLAUDE_MODEL` env var.

# TradeFix

An AI-powered trading journal MVP — inspired by SuperTrader's `/today` daily briefing. Log trades, get deterministic pattern insights, and run 5 AI agents (Morning Brief, Pattern Scout, Risk Contribution, Hot Take, Journal Pulse) powered by OpenRouter's free tier. No broker sync, no Docker — everything runs natively on your machine.

## Tech stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + TanStack Query + Recharts
- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2
- **Database:** PostgreSQL (installed natively, no Docker)
- **Auth:** Email/password + JWT
- **AI:** OpenRouter (OpenAI-compatible API), free-tier auto-router model

## Prerequisites

Install these before running the app — none of them were pre-installed on this machine, so you'll need to install them yourself:

1. **Python 3.11+** — https://www.python.org/downloads/ (check "Add python.exe to PATH" during install)
2. **Node.js 20+** (includes npm) — https://nodejs.org/
3. **PostgreSQL 16** — https://www.postgresql.org/download/windows/ (the installer includes pgAdmin 4 and runs Postgres as a Windows service automatically)
4. A free **OpenRouter API key** — https://openrouter.ai/keys (no credit card required)

After installing, open a **new** terminal (so PATH updates take effect) and verify:

```powershell
python --version
node --version
npm --version
psql --version
```

## 1. Create the database

Using `psql` (or pgAdmin's Query Tool):

```sql
CREATE DATABASE tradefix2;
CREATE USER tradefix_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE tradefix2 TO tradefix_user;
```

## 2. Backend setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# then edit .env: set DATABASE_URL password, JWT_SECRET, and OPENROUTER_API_KEY

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

## 3. Frontend setup

In a second terminal:

```powershell
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Frontend runs at `http://localhost:3000`. Sign up, and you'll land on `/today`.

## What's implemented

- **Auth** — signup/login/JWT, `/api/auth/*`
- **Journal** — manual trade CRUD + CSV import (`/journal`), auto-mapped columns for common broker CSV exports
- **Today** — daily P&L, open positions, combined insight feed (`/today`)
- **Calendar** — month grid + year heatmap of P&L (`/calendar`)
- **Analytics** — win rate by hour/day-of-week, setup breakdown with 30-day trend, mood vs P&L (`/analytics`)
- **Rule-based insights** — Time Edge, Streak Alert, Setup Win/Decay — no LLM or API key required, runs instantly
- **AI Agents Inbox** (`/agents`) — 5 agents, each a single OpenRouter call grounded in precomputed stats (never invents numbers):
  - **Morning Brief** — daily pre-market summary from your watchlist, open positions, and recent stats
  - **Pattern Scout** — flags which tagged setup is trending up in win rate
  - **Risk Contribution** — flags position concentration and drawdown risk
  - **Hot Take** — weekly bold thesis from your own performance trends
  - **Journal Pulse** — reads your mood check-ins vs P&L (local stand-in for SuperTrader's "The Crowd", since there's no external sentiment source in scope)
  - An in-process scheduler (APScheduler) runs the daily agents at 8am and Hot Take on Sundays; you can also click "Run now" per agent any time
- **Settings** — watchlist management (feeds Morning Brief), mood check-ins (feeds Journal Pulse), **profile** (editable fields + avatar upload to local `/uploads` storage, persisted in Postgres)

## Explicitly out of scope

- Live broker sync/OAuth (MT4/MT5, Robinhood, IBKR, etc.) — CSV import only
- Live market data / tick-based monitoring — agents run on your logged trade history instead

## Branding

The sidebar/login use a CSS-based "TF" badge (`components/ui/Logo.tsx`) matching your gold-on-black logo. To use your exact artwork instead, save it as `frontend/public/logo.png` and swap the badge markup for an `<img src="/logo.png" />`.

## Project layout

```
backend/
  app/
    core/        settings, db session, JWT/password hashing
    models/      SQLAlchemy models
    schemas/     Pydantic request/response schemas
    api/routers/ auth, trades, imports, analytics, calendar, insights, agents, watchlist, mood
    services/    stats_service (all number-crunching), csv_import_service, insight_rules, scheduler
    services/ai/ OpenRouter client, prompts, and the 5 agent classes
  alembic/       migrations
frontend/
  app/(auth)/    login, signup
  app/(app)/     today, journal, calendar, analytics, agents, settings
  components/    ui primitives, trades, calendar, insights, charts, layout
  lib/           api client, hooks, types
```

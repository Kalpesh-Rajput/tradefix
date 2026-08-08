# TradeFix — Free Deploy Guide (Brother Review)

Use this when you want a **public link** so someone can review TradeFix without installing anything on their machine.

This is a **review copy**. Keep coding and improving on your PC (`localhost`). The live site updates when you push to GitHub.

---

## What gets deployed

| Part | Free service | Project folder |
|------|----------------|----------------|
| Website (Next.js) | [Vercel](https://vercel.com) | `frontend/` |
| API (FastAPI) | [Render](https://render.com) | `backend/` |
| Database (Postgres) | [Neon](https://neon.tech) | cloud (not local) |

```text
Brother's browser
       │
       ▼
  Vercel (frontend)  ──API calls──►  Render (backend)  ──SQL──►  Neon (Postgres)
```

### Free-tier expectations

- **Render free** sleeps after idle. First open after sleep can take **30–60 seconds**. Tell the reviewer to wait once.
- **Uploads** (avatars, screenshots) are stored on the Render disk and **may disappear** when the free instance restarts. Fine for review; not durable production storage.
- Email/password signup works without Google. Google login is optional.

---

## Suggested order

1. Push the repo to GitHub  
2. Create Neon database  
3. Deploy backend on Render  
4. Deploy frontend on Vercel  
5. Point backend `FRONTEND_ORIGIN` at the Vercel URL  
6. Test yourself → send the link  

---

## Before you start

### 1. Push the project to GitHub

1. Create a free account at [github.com](https://github.com) if needed.
2. Create a **new repository** (private is fine), e.g. `TradeFix`.
3. From your machine, push this project to that repo.

**Do not commit secrets.** Never push:

- `backend/.env`
- `frontend/.env.local`
- API keys, passwords, JWT secrets

Only examples like `.env.example` should be in git.

### 2. Create free accounts (sign up with GitHub)

- [neon.tech](https://neon.tech) — database  
- [render.com](https://render.com) — API  
- [vercel.com](https://vercel.com) — website  

---

## Part A — Database (Neon)

1. Neon → **New Project** → name it something like `tradefix`.
2. After creation, open the **Connection details / Connection string**.
3. Copy the URL. It usually looks like:

   ```text
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```

4. Change **only** the scheme so TradeFix’s SQLAlchemy driver works:

   ```text
   postgresql+psycopg://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```

   - From: `postgresql://`  
   - To: `postgresql+psycopg://`  
   - Keep the rest the same (including `?sslmode=require`).

5. Save this string — you will paste it into Render as `DATABASE_URL`.

---

## Part B — Backend API (Render)

1. Render dashboard → **New +** → **Web Service**.
2. Connect your GitHub account and select the **TradeFix** repo.
3. Configure:

   | Setting | Value |
   |---------|--------|
   | Name | `tradefix-api` (or any name) |
   | Region | Closest to you / your brother |
   | Root Directory | `backend` |
   | Runtime | Python 3 |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Instance type | **Free** |

4. Add **Environment Variables**:

   | Key | Value |
   |-----|--------|
   | `PYTHON_VERSION` | `3.11.11` (**required** — Render defaults to 3.14, which breaks this app) |
   | `DATABASE_URL` | Neon URL with `postgresql+psycopg://` (from Part A) |
   | `JWT_SECRET` | Long random string (40+ characters) |
   | `FRONTEND_ORIGIN` | Temporary: `http://localhost:3000` — **update after Vercel** |
   | `OPENROUTER_API_KEY` | Your OpenRouter key (needed for AI agents) |
   | `GOOGLE_CLIENT_ID` | Optional — same Web client ID as local |
   | `GOOGLE_CLIENT_SECRET` | Optional |
   | `ENABLE_SCHEDULER` | `true` |

   The repo also includes `backend/.python-version` set to `3.11.11`. Still set `PYTHON_VERSION` on Render so the build cannot pick 3.14 by mistake.

5. Click **Create Web Service** and wait until status is **Live**.
6. Copy the service URL, for example:

   ```text
   https://tradefix-api.onrender.com
   ```

7. Open this in a browser to verify:

   ```text
   https://tradefix-api.onrender.com/api/health
   ```

   You should see JSON like `{"status":"ok","app":"TradeFix"}`.

If health fails, open **Logs** on Render and check for database URL / migration errors.

---

## Part C — Frontend (Vercel)

1. Vercel → **Add New…** → **Project** → import the same GitHub repo.
2. Configure:

   | Setting | Value |
   |---------|--------|
   | Framework Preset | Next.js (usually auto-detected) |
   | Root Directory | `frontend` ← click **Edit** and set this |
   | Build Command | `npm run build` (default) |
   | Install Command | `npm install` (default) |

3. Add **Environment Variables**:

   | Key | Value |
   |-----|--------|
   | `NEXT_PUBLIC_API_URL` | Your Render URL, e.g. `https://tradefix-api.onrender.com` (**no** trailing slash) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional — same as local if using Google login |

4. Click **Deploy** and wait for success.
5. Copy the site URL, for example:

   ```text
   https://tradefix-xxxx.vercel.app
   ```

---

## Part D — Connect frontend and backend

### 1. Update CORS on Render

1. Render → your web service → **Environment**.
2. Set:

   ```text
   FRONTEND_ORIGIN=https://tradefix-xxxx.vercel.app
   ```

   Use your **exact** Vercel URL. No trailing slash.

3. Save — Render will redeploy.

### 2. Google login (optional)

In [Google Cloud Console](https://console.cloud.google.com/) → your OAuth **Web client** → **Authorized JavaScript origins**, add:

- `https://tradefix-xxxx.vercel.app`
- `http://localhost:3000` (keep this for local development)

Email/password signup works without this step.

---

## Part E — Share with your brother

Send him:

1. The Vercel URL: `https://tradefix-xxxx.vercel.app`
2. A short note: **first visit may take up to a minute** while the free API wakes up.
3. Ask him to use **Sign up** with email/password (simplest for review).

Optionally create a test account yourself first and share those credentials.

---

## How you keep improving after deploy

| Task | Where |
|------|--------|
| Feature work, bugs, UI | Your PC — `localhost:3000` + `localhost:8000` |
| Brother’s review copy | Vercel + Render + Neon |

### Updating the live review site

1. Finish and test the change locally.
2. Commit and **push to GitHub**.
3. Vercel and Render usually **auto-redeploy** in a few minutes.

You do not need to recreate Neon / Render / Vercel projects each time.

Local database and cloud database are **separate**. Data your brother creates on the live site will not appear on your laptop (and vice versa), unless you point both at the same Neon DB on purpose.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Build fails: Vulnerable Next.js detected | Upgrade `frontend` Next.js and push (`package.json` + lockfile). Current target: `15.5.23` |
| Build fails on `pydantic-core` / Python 3.14 | Set Render env `PYTHON_VERSION=3.11.11`, then **Manual Deploy → Clear build cache & deploy** |
| Site loads but login / API fails | Vercel `NEXT_PUBLIC_API_URL` must match the Render URL (https, no trailing slash) |
| Browser CORS / blocked request | Render `FRONTEND_ORIGIN` must match the Vercel URL exactly |
| API spins / 502 for a long time | Free Render cold start — wait ~1 minute; check Render **Logs** |
| `No module named 'psycopg2'` | `DATABASE_URL` used `postgresql://` (psycopg2). Use `postgresql+psycopg://`, or redeploy after the config normalizer is pushed |
| Migration / DB errors on boot | `DATABASE_URL` should include `?sslmode=require` for Neon |
| Google login fails on live site | Add Vercel domain to Google Authorized JavaScript origins |
| Avatar / screenshot missing later | Expected on free Render (ephemeral disk) — ignore for review |
| AI agents fail | Set `OPENROUTER_API_KEY` on Render |

Useful checks:

- API health: `https://YOUR-RENDER-URL/api/health`
- API docs (if enabled): `https://YOUR-RENDER-URL/docs`

---

## Alternative: temporary share from your PC (ngrok)

Use this only if you need a quick look while **your computer stays on**. Not a real always-on deploy.

1. Run backend and frontend locally as usual (see root `README.md`).
2. Expose your machine with [ngrok](https://ngrok.com) (or Cloudflare Tunnel).
3. Send the temporary URL.

Prefer **Neon + Render + Vercel** if your brother should open the app anytime without your PC running.

---

## Environment reference

### Backend (Render)

| Variable | Required | Notes |
|----------|----------|--------|
| `PYTHON_VERSION` | Yes | `3.11.11` (avoid Render’s default 3.14) |
| `DATABASE_URL` | Yes | Neon URL with `postgresql+psycopg://` |
| `JWT_SECRET` | Yes | Long random secret |
| `FRONTEND_ORIGIN` | Yes | Exact Vercel URL |
| `OPENROUTER_API_KEY` | For AI | Free key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `GOOGLE_CLIENT_ID` | Optional | Same Web client ID as frontend |
| `GOOGLE_CLIENT_SECRET` | Optional | |
| `ENABLE_SCHEDULER` | Optional | Default `true` |

### Frontend (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_API_URL` | Yes | Render base URL, no trailing slash |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional | Enables Google button |

Local examples live in:

- `backend/.env.example`
- `frontend/.env.local.example`

---

## Quick checklist

- [ ] Code on GitHub (no `.env` secrets)
- [ ] Neon project created; `postgresql+psycopg://` URL ready
- [ ] Render has `PYTHON_VERSION=3.11.11`
- [ ] Render web service live; `/api/health` returns ok
- [ ] Vercel project with Root Directory = `frontend`
- [ ] `NEXT_PUBLIC_API_URL` → Render URL
- [ ] `FRONTEND_ORIGIN` → Vercel URL
- [ ] You can sign up and open `/today` on the live site
- [ ] Link sent to reviewer (with cold-start note)

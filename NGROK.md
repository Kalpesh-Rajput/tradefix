# TradeFix live link (ngrok)

Use this when you want a **public HTTPS URL** so someone can open TradeFix in their browser without installing anything.

Your PC is the server. It must stay **on, awake, and connected to the internet**. This is not a permanent deploy. For an always-on site, use `DEPLOY.md` (Vercel + Render + Neon).

---

## What testers get

You send **one HTTPS link**. Testers open it, click through the ngrok warning if shown, then use TradeFix like a normal website.

Next.js already proxies `/api` and `/uploads` to the backend on this machine, so testers do **not** need a second URL for the TradeFix API.

```text
Tester browser
      │
      ▼
  ngrok HTTPS  ──►  Next.js :3000  ──►  FastAPI :8001  ──►  local Postgres
```

---

## Before you start

Confirm the app already works on **your** machine:

- Frontend: http://localhost:3000
- Backend: http://localhost:8001/api/health → `{"status":"ok","app":"TradeFix"}`

If those fail, follow the setup in `README.md` first (Python, Node, Postgres, `.env` files). Do not start ngrok until localhost works.

Also:

1. Keep the laptop plugged in.
2. Turn off sleep while people are testing (Windows: Settings → System → Power → Screen and sleep → **Never** while plugged in).
3. Do not close the three terminal windows listed below.

---

## 1. One-time ngrok setup

Do this once per PC.

1. Create a free account: https://dashboard.ngrok.com/signup
2. Download ngrok: https://ngrok.com/download  
   On Windows, unzip `ngrok.exe` and put it somewhere on your PATH, or run it from the folder you unzipped.
3. Copy your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
4. In PowerShell:

```powershell
ngrok config add-authtoken PASTE_YOUR_TOKEN_HERE
```

Check it works:

```powershell
ngrok version
```

---

## 2. Start TradeFix (every time)

Open **three** PowerShell windows. Leave all of them open.

### Window 1 — backend

```powershell
cd C:\test\KR\Project-TradeFix\TradeFix\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8001
```

Wait until you see the Uvicorn "Application startup complete" line.

Quick check:

```powershell
curl http://127.0.0.1:8001/api/health
```

### Window 2 — frontend

```powershell
cd C:\test\KR\Project-TradeFix\TradeFix\frontend
npm run dev
```

Wait until it says **Ready** on `http://localhost:3000`.

Open http://localhost:3000 yourself and confirm login works **before** you start ngrok.

### Window 3 — ngrok (the public link)

Point ngrok at the **website**, not the API:

```powershell
ngrok http 3000
```

You should see a table like:

```text
Forwarding    https://abcd-12-34-56-78.ngrok-free.app -> http://localhost:3000
```

Copy the **https** URL only. No trailing slash.

You can also copy it from the local inspector: http://127.0.0.1:4040

---

## 3. Check the live link yourself first

Open these in **your** browser (use your real URL):

```text
https://YOUR-NGROK-URL
https://YOUR-NGROK-URL/api/health
```

`/api/health` should return:

```json
{"status":"ok","app":"TradeFix"}
```

### ngrok warning page

Free ngrok often shows **Visit Site** the first time. Click it. After that, TradeFix loads.

If login or API calls fail with a JSON parse error, the warning page is still intercepting requests. Visit the homepage once, click **Visit Site**, then retry.

---

## 4. Send the link

Send testers:

1. The **https** ngrok URL
2. A note that the first visit may show an ngrok interstitial — they should click **Visit Site**
3. Signup/login works as usual (email + password)

Do **not** send:

- `http://localhost:3000`
- The backend URL (`:8001`)
- Your ngrok authtoken
- `backend/.env` or `frontend/.env.local`

---

## 5. Keep the link alive

The URL stays up only while **all** of this is true:

| Must stay running | If it stops |
| ----------------- | ----------- |
| Window 1 backend | API / login / data fail |
| Window 2 frontend | Site does not load |
| Window 3 ngrok | Public URL dies |
| PC awake + internet | Tunnel drops |

A **free ngrok URL changes** every time you restart ngrok. If the tunnel dies, start `ngrok http 3000` again and send the **new** URL.

---

## 6. Stop

1. In the ngrok window: `Ctrl+C`
2. Optionally stop frontend and backend the same way
3. Next session: start all three windows again and send the new URL

---

## Optional: second live URL (broker / MT5)

This is a **different** tunnel. The TradeFix website link above does **not** expose MetaTrader.

The broker page talks to **TradeFix-Connectors** via `NEXT_PUBLIC_CONNECTORS_URL` in `frontend/.env.local`.

Free ngrok usually allows **one** tunnel at a time. Stop `ngrok http 3000` before starting the connectors tunnel, or use a paid ngrok plan for two tunnels.

### Start connectors

**Window A — MetaTrader 5**  
Stay logged in. Keep the PC awake.

**Window B — Connectors API** (not TradeFix on port 8001):

```powershell
cd C:\test\KR\Project-TradeFix\TradeFix-Connectors
.\scripts\start-api.ps1
```

If port 8000 is busy:

```powershell
.\scripts\start-api.ps1 -Port 8100
```

**Window C — ngrok on the same port as the connectors API:**

```powershell
cd C:\test\KR\Project-TradeFix\TradeFix-Connectors
.\scripts\start-ngrok.ps1
```

If the API is on 8100:

```powershell
.\scripts\start-ngrok.ps1 -Port 8100
```

Copy the **https** Forwarding URL (no trailing slash). Check:

```text
https://YOUR-CONNECTORS-NGROK-URL/health
```

### Point TradeFix at it

1. Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_CONNECTORS_URL=https://YOUR-CONNECTORS-NGROK-URL
```

2. Restart the frontend (`Ctrl+C`, then `npm run dev`). Next.js only reads `NEXT_PUBLIC_*` on startup.
3. Open http://localhost:3000 → **Settings → Broker**. The URL should appear at the top.

If you also need testers to use the website over ngrok **and** live broker sync, you need **two** tunnels (paid ngrok, or two accounts — not recommended). Otherwise share only the TradeFix app URL (section 2–4) without live MT5.

---

## Troubleshooting

| Problem | What to do |
| ------- | ---------- |
| `ngrok` is not recognized | Install ngrok, add it to PATH, open a **new** PowerShell |
| `ERR_NGROK_4018` / authtoken | Run `ngrok config add-authtoken YOUR_TOKEN` |
| `ERR_NGROK_334` / one session | Another ngrok is already running. Close it, or stop the extra tunnel |
| Blank page / connection refused | Frontend is not on port 3000. Wait for "Ready", then restart ngrok |
| `/api/health` not ok | Backend is not on port 8001. Start Window 1 first |
| Login works on localhost, fails on ngrok | Open the ngrok URL once, click **Visit Site**, hard-refresh |
| CORS / blocked by Next.js | You are on the HTTPS ngrok URL; keep using that, not `localhost` in the same session |
| URL worked yesterday, 404 today | Free URL expired. Start ngrok again and send the new link |
| PC slept | Wake it, confirm localhost:3000, restart ngrok if the tunnel died |
| Google login fails on the public URL | Email/password still works. Google OAuth needs the ngrok origin added in Google Cloud Console |
| Two people cannot open it | Free ngrok allows the public URL; if it is slow or blocked, you hit the free-plan limit — retry or upgrade |
| Want a stable URL | Paid ngrok reserved domain, or real deploy in `DEPLOY.md` |

Inspect live requests: http://127.0.0.1:4040

---

## Security

- Anyone with the URL can reach **your** running app and **your** local database (they still need a TradeFix account).
- Do not post the URL on a public forum.
- Stop ngrok when testing is done.
- Never commit `.env` files or your ngrok authtoken.

---

## Quick copy-paste (after ngrok is installed)

```powershell
# Terminal 1
cd C:\test\KR\Project-TradeFix\TradeFix\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8001

# Terminal 2
cd C:\test\KR\Project-TradeFix\TradeFix\frontend
npm run dev

# Terminal 3
ngrok http 3000
```

Share the **https** Forwarding URL from terminal 3.

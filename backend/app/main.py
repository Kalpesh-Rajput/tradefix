from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import agents, analytics, auth, calendar, imports, insights, mood, trades, watchlist
from app.core.config import settings
from app.services.scheduler import shutdown_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.enable_scheduler:
        start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Next.js falls back to 3001 when 3000 is already in use
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(imports.router)
app.include_router(analytics.router)
app.include_router(calendar.router)
app.include_router(insights.router)
app.include_router(agents.router)
app.include_router(watchlist.router)
app.include_router(mood.router)

uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.app_name}

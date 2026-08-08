from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import (
    accounts,
    agents,
    analytics,
    auth,
    calendar,
    checkins,
    coach,
    imports,
    insights,
    mentor,
    mood,
    prop,
    recaps,
    trades,
    watchlist,
)
from app.core.config import settings
from app.core.security import decode_access_token
from app.services.scheduler import shutdown_scheduler, start_scheduler
from app.services.ws_hub import hub


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    try:
        import asyncio

        hub.set_loop(asyncio.get_running_loop())
    except Exception:
        pass
    if settings.enable_scheduler:
        start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.frontend_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(trades.router)
app.include_router(imports.router)
app.include_router(analytics.router)
app.include_router(calendar.router)
app.include_router(insights.router)
app.include_router(agents.router)
app.include_router(watchlist.router)
app.include_router(mood.router)
app.include_router(recaps.router)
app.include_router(checkins.router)
app.include_router(prop.router)
app.include_router(coach.router)
app.include_router(mentor.router)

uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.app_name}


@app.websocket("/ws/account")
async def account_ws(websocket: WebSocket, token: str | None = None):
    user_id = decode_access_token(token or "") if token else None
    if not user_id:
        await websocket.close(code=4401)
        return
    await hub.connect(user_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "user_id": user_id})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(user_id, websocket)
    except Exception:
        hub.disconnect(user_id, websocket)

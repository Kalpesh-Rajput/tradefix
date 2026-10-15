"""Start the API, the market worker, and the frontend together.

A second worker is not started when one already holds the advisory lock. Machines that are off at
the nightly 00:35 UTC top-up catch up when the API starts (see catch_up_topup).
"""

from __future__ import annotations

import argparse
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
PYTHON = BACKEND / "venv" / "Scripts" / "python.exe"
if not PYTHON.exists():
    PYTHON = BACKEND / "venv" / "bin" / "python"


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _worker_running() -> bool:
    sys.path.insert(0, str(BACKEND))
    from sqlalchemy import text

    from app.core.config import settings
    from app.core.db import engine

    with engine.connect() as conn:
        acquired = bool(conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": settings.market_worker_lock_key}).scalar())
        if acquired:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": settings.market_worker_lock_key})
            conn.commit()
        return not acquired


def _spawn(name: str, command: list[str], cwd: Path) -> subprocess.Popen:
    print(f"[{name}] starting: {' '.join(command)}", flush=True)
    return subprocess.Popen(command, cwd=cwd)


def main() -> int:
    parser = argparse.ArgumentParser(description="Start the TradeFix API, market worker, and frontend")
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--web-port", type=int, default=3000)
    args = parser.parse_args()
    processes: list[tuple[str, subprocess.Popen]] = []
    python = str(PYTHON if PYTHON.exists() else Path(sys.executable))
    if _port_open(args.api_port):
        print(f"[api] port {args.api_port} is already in use; not starting a second API", flush=True)
    else:
        processes.append(("api", _spawn("api", [python, "-m", "uvicorn", "app.main:app", "--reload", "--port", str(args.api_port)], BACKEND)))
    if _worker_running():
        print("[worker] another market worker already holds the lock; not starting a second one", flush=True)
    else:
        processes.append(("worker", _spawn("worker", [python, "-m", "app.workers.market_worker"], BACKEND)))
    if _port_open(args.web_port):
        print(f"[web] port {args.web_port} is already in use; not starting a second frontend", flush=True)
    else:
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        processes.append(("web", _spawn("web", [npm, "run", "dev", "--", "--port", str(args.web_port)], FRONTEND)))
    if not processes:
        print("nothing to start", flush=True)
        return 0
    print("running. Press Ctrl+C to stop the processes this command started.", flush=True)
    try:
        processes[0][1].wait()
    except KeyboardInterrupt:
        print("stopping", flush=True)
    finally:
        for name, process in processes:
            if process.poll() is None:
                process.terminate()
                print(f"[{name}] stopped", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

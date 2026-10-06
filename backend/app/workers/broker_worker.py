"""Processes sync_jobs outside the request cycle.

Run as `python -m app.workers.broker_worker`, or let the API start one thread
when BROKER_WORKER_IN_PROCESS is true. Advisory locks stop two workers from
syncing the same connection.
"""

from __future__ import annotations

import logging
import threading
import time

from app.core.db import SessionLocal
from app.services.sync.engine import process_available

logger = logging.getLogger("tradefix.broker_worker")
_started = False


def run_forever() -> None:
    while True:
        db = SessionLocal()
        try:
            process_available(db, limit=2)
        except Exception:
            logger.exception("broker worker loop failed")
        finally:
            db.close()
        time.sleep(2)


def start_in_process() -> None:
    global _started
    if _started:
        return
    _started = True
    threading.Thread(target=run_forever, name="broker-worker", daemon=True).start()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_forever()

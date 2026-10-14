"""Session-level Postgres advisory locks held on a dedicated connection (D-019).

A singleton process (market worker, scheduler) keeps the lock for its lifetime. The connection runs in
AUTOCOMMIT so the lock never pins an idle-in-transaction session.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

logger = logging.getLogger(__name__)


class AdvisoryLock:
    def __init__(self, key: int, engine: Engine | None = None) -> None:
        if engine is None:
            from app.core.db import engine as default_engine

            engine = default_engine
        self.key = key
        self.engine = engine
        self._conn: Connection | None = None

    @property
    def held(self) -> bool:
        return self._conn is not None

    def try_acquire(self) -> bool:
        if self._conn is not None:
            return True
        conn = self.engine.connect().execution_options(isolation_level="AUTOCOMMIT")
        try:
            acquired = bool(conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": self.key}).scalar())
        except Exception:
            conn.close()
            raise
        if not acquired:
            conn.close()
            return False
        self._conn = conn
        return True

    def alive(self) -> bool:
        """True while the holding connection still answers; a dropped connection means the lock is gone."""
        if self._conn is None:
            return False
        try:
            self._conn.execute(text("SELECT 1"))
            return True
        except Exception:
            logger.warning("advisory lock connection lost", extra={"key": self.key})
            self._discard()
            return False

    def release(self) -> None:
        if self._conn is None:
            return
        try:
            self._conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": self.key})
        except Exception:
            logger.warning("advisory unlock failed; closing the connection releases it", extra={"key": self.key})
        finally:
            self._discard()

    def _discard(self) -> None:
        conn, self._conn = self._conn, None
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass

    def __enter__(self) -> "AdvisoryLock":
        return self

    def __exit__(self, *exc) -> None:
        self.release()

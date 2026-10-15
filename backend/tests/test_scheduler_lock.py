"""Only one process holds the scheduler advisory lock."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from app.services.jobs.locks import AdvisoryLock
from tests.bt_support import requires_db

pytestmark = requires_db
BACKEND = Path(__file__).resolve().parents[1]
KEY = 741234


def _other_process() -> str:
    result = subprocess.run(
        [sys.executable, "-c", f"from app.services.jobs.locks import AdvisoryLock; print(AdvisoryLock({KEY}).try_acquire())"],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        timeout=40,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_a_second_process_cannot_take_the_scheduler_lock():
    holder = AdvisoryLock(KEY)
    assert holder.try_acquire()
    try:
        assert _other_process() == "False"
    finally:
        holder.release()
    follower = AdvisoryLock(KEY)
    assert follower.try_acquire()
    follower.release()

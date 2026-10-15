"""Startup top-up catch-up (F6). The nightly job is 00:35 UTC, so a machine that was off then catches up."""

from datetime import datetime, timedelta, timezone

from app.models.job import Job, WorkerHeartbeat
from app.services.health import worker_status
from app.services.marketdata.topup import catch_up_topup
from tests.bt_support import db, requires_db

pytestmark = requires_db


def _success(when: datetime | None) -> Job:
    return Job(
        type="candles.topup",
        lane="binance",
        status="succeeded",
        payload={},
        dedup_key=None,
        finished_at=when,
        max_attempts=1,
    )


def test_catch_up_enqueues_when_the_last_success_is_old(db):
    moment = datetime(2030, 1, 15, 12, tzinfo=timezone.utc)
    assert catch_up_topup(db, now=moment) is True
    db.add(_success(datetime(2030, 1, 15, 11, tzinfo=timezone.utc)))
    db.commit()
    assert catch_up_topup(db, now=moment) is False


def test_catch_up_uses_the_day_key_when_nothing_recent_succeeded(db):
    moment = datetime(2030, 1, 16, 18, tzinfo=timezone.utc)
    db.add(_success(moment - timedelta(hours=30)))
    db.commit()
    assert catch_up_topup(db, now=moment) is True
    assert catch_up_topup(db, now=moment) is False


def test_worker_status_hides_the_command_from_traders(db):
    row = db.get(WorkerHeartbeat, "market_worker") or WorkerHeartbeat(name="market_worker", instance="test", info={})
    row.last_seen = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    trader = worker_status(db, admin=False)
    admin = worker_status(db, admin=True)
    assert trader["stale"] is False and "command" not in trader
    assert admin["command"] == "python scripts/dev.py" and admin["heartbeat_age_s"] is not None
    assert admin["slow_after_s"] == 180

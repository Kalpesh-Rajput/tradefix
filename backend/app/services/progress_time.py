"""Timezone helpers for Progress Tracker. Never assume server local time."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def resolve_timezone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo((name or "UTC").strip() or "UTC")
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def now_in_tz(tz: ZoneInfo) -> datetime:
    return datetime.now(timezone.utc).astimezone(tz)


def today_in_tz(tz: ZoneInfo) -> date:
    return now_in_tz(tz).date()


def local_date(dt: datetime, tz: ZoneInfo) -> date:
    return ensure_aware(dt).astimezone(tz).date()


def local_time(dt: datetime, tz: ZoneInfo) -> time:
    return ensure_aware(dt).astimezone(tz).timetz().replace(tzinfo=None)


def parse_hhmm(value: str) -> time:
    hour, minute = value.split(":")
    return time(int(hour), int(minute))


def minutes_since_midnight(value: time | str) -> int:
    if isinstance(value, str):
        value = parse_hhmm(value)
    return value.hour * 60 + value.minute


def day_bounds_utc(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start_local = datetime.combine(day, time.min, tzinfo=tz)
    end_local = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def weekday_key(day: date) -> str:
    return WEEKDAY_KEYS[day.weekday()]


def is_active_day(day: date, active_days: list[str] | None) -> bool:
    days = [str(d).lower()[:3] for d in (active_days or [])]
    return weekday_key(day) in days


def daterange(start: date, end: date):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


def time_in_window(local: time, start: str, end: str) -> bool:
    """Inclusive start, exclusive end. Overnight windows (start > end) are supported."""
    current = minutes_since_midnight(local)
    begin = minutes_since_midnight(start)
    finish = minutes_since_midnight(end)
    if begin == finish:
        return False
    if begin < finish:
        return begin <= current < finish
    return current >= begin or current < finish

"""Binance 1m klines (backtesting/02 section 6).

Planning: whole past months come from monthly archives, whole past days from daily archives, and
anything partial or recent from REST klines. A missing archive (404) falls back to REST for its range.
Only fully closed minutes are ever returned.
"""

from __future__ import annotations

import csv
import hashlib
import io
import logging
import random
import time
import zipfile
from dataclasses import dataclass
from typing import Callable, Iterator

import httpx
import numpy as np

from app.core.config import settings
from app.services.marketdata.candles import MINUTE_MS, Candles
from app.services.marketdata.providers.base import Chunk, ProviderError, Throttle, no_throttle
from app.services.marketdata.registry import InstrumentSpec
from app.services.marketdata.store import month_bounds, month_key

logger = logging.getLogger(__name__)

DAY_MS = 86_400_000
MICROSECOND_THRESHOLD = 10**15
MAX_HTTP_ATTEMPTS = 6
REST_TIMEOUT_S = 15.0
ARCHIVE_TIMEOUT_S = 60.0
WEIGHT_HEADER = "x-mbx-used-weight-1m"


@dataclass(frozen=True)
class _Market:
    archive_path: str
    rest_path: str
    page_limit: int
    weight_limit: int


SPOT = _Market("spot", "/api/v3/klines", 1000, 6000)
FUTURES = _Market("futures/um", "/fapi/v1/klines", 1500, 2400)


@dataclass(frozen=True)
class Segment:
    kind: str
    start_ms: int
    end_ms: int


def normalize_timestamps(raw: np.ndarray) -> np.ndarray:
    """Binance moved spot archives to microseconds in 2025: 16-digit values are us, 13-digit are ms."""
    values = np.asarray(raw, dtype=np.int64)
    return np.where(values >= MICROSECOND_THRESHOLD, values // 1000, values)


def parse_kline_rows(rows: list[list]) -> Candles:
    """First six columns: open time, open, high, low, close, volume. Header rows are skipped."""
    data = [r[:6] for r in rows if r and str(r[0]).strip().lstrip("-").isdigit()]
    if not data:
        return Candles.empty()
    columns = list(zip(*data))
    return Candles.from_columns(
        {
            "ts": normalize_timestamps(np.array([int(v) for v in columns[0]], dtype=np.int64)),
            "open": [float(v) for v in columns[1]],
            "high": [float(v) for v in columns[2]],
            "low": [float(v) for v in columns[3]],
            "close": [float(v) for v in columns[4]],
            "volume": [float(v) for v in columns[5]],
        }
    )


def parse_archive(payload: bytes) -> Candles:
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            name = next(n for n in archive.namelist() if n.lower().endswith(".csv"))
            text = archive.read(name).decode("utf-8")
    except (zipfile.BadZipFile, StopIteration, UnicodeDecodeError) as exc:
        raise ProviderError("archive_unreadable", f"binance archive could not be read: {exc}") from exc
    return parse_kline_rows(list(csv.reader(io.StringIO(text))))


def verify_checksum(payload: bytes, checksum_text: str) -> bool:
    expected = (checksum_text or "").strip().split()
    return bool(expected) and hashlib.sha256(payload).hexdigest() == expected[0].lower()


def closed_end(end_ms: int, now_ms: int) -> int:
    """The last fully closed minute boundary: the still-forming minute is never final."""
    return min(end_ms, now_ms - now_ms % MINUTE_MS)


def plan_segments(start_ms: int, end_ms: int, now_ms: int) -> list[Segment]:
    end = closed_end(end_ms, now_ms)
    today_start = now_ms - now_ms % DAY_MS
    current_month_start = month_bounds(*month_key(now_ms))[0]
    segments: list[Segment] = []
    cursor = start_ms - start_ms % MINUTE_MS
    while cursor < end:
        m_start, m_end = month_bounds(*month_key(cursor))
        if cursor == m_start and m_end <= end and m_end <= current_month_start:
            segments.append(Segment("monthly", m_start, m_end))
            cursor = m_end
            continue
        d_start = cursor - cursor % DAY_MS
        d_end = d_start + DAY_MS
        if cursor == d_start and d_end <= end and d_end <= today_start:
            segments.append(Segment("daily", d_start, d_end))
            cursor = d_end
            continue
        seg_end = min(end, d_end)
        segments.append(Segment("rest", cursor, seg_end))
        cursor = seg_end
    return segments


class BinanceProvider:
    name = "binance"

    def __init__(
        self,
        *,
        client: httpx.Client | None = None,
        throttle: Throttle | None = None,
        sleep: Callable[[float], None] = time.sleep,
        now_ms: Callable[[], int] | None = None,
        rest_hosts: list[str] | None = None,
        futures_host: str | None = None,
        archive_host: str | None = None,
    ) -> None:
        self.client = client or httpx.Client(headers={"User-Agent": "TradeFix-marketdata/1.0"})
        self.throttle = throttle or no_throttle
        self.sleep = sleep
        self.now_ms = now_ms or (lambda: int(time.time() * 1000))
        self.rest_hosts = rest_hosts or [h.strip().rstrip("/") for h in settings.binance_rest_hosts.split(",") if h.strip()]
        self.futures_host = (futures_host or settings.binance_futures_rest_host).rstrip("/")
        self.archive_host = (archive_host or settings.binance_archive_host).rstrip("/")
        self._preferred: dict[str, int] = {}

    def _market(self, spec: InstrumentSpec) -> _Market:
        return FUTURES if spec.market_type == "usdm_futures" else SPOT

    def iter_chunks(self, spec: InstrumentSpec, start_ms: int, end_ms: int) -> Iterator[Chunk]:
        for segment in plan_segments(start_ms, end_ms, self.now_ms()):
            candles: Candles | None = None
            via = segment.kind
            if segment.kind in ("monthly", "daily"):
                candles = self.fetch_archive(spec, segment)
                if candles is None:
                    via = "rest_fallback"
            if candles is None:
                candles = self.fetch_rest(spec, segment.start_ms, segment.end_ms)
            yield Chunk(segment.start_ms, segment.end_ms, candles.between(segment.start_ms, segment.end_ms), via)

    def archive_url(self, spec: InstrumentSpec, segment: Segment) -> str:
        year, month = month_key(segment.start_ms)
        stamp = f"{year:04d}-{month:02d}"
        if segment.kind == "daily":
            stamp += f"-{time.gmtime(segment.start_ms / 1000).tm_mday:02d}"
        symbol = spec.provider_id
        market = self._market(spec).archive_path
        return f"{self.archive_host}/data/{market}/{segment.kind}/klines/{symbol}/1m/{symbol}-1m-{stamp}.zip"

    def fetch_archive(self, spec: InstrumentSpec, segment: Segment) -> Candles | None:
        url = self.archive_url(spec, segment)
        for attempt in range(2):
            self.throttle()
            payload = self._download(url)
            if payload is None:
                logger.info("binance archive missing, falling back to REST", extra={"url": url})
                return None
            checksum = self._download(url + ".CHECKSUM")
            if checksum is None:
                logger.warning("binance checksum missing, falling back to REST", extra={"url": url})
                return None
            if verify_checksum(payload, checksum.decode("utf-8", "replace")):
                return parse_archive(payload)
            logger.warning("binance archive checksum mismatch", extra={"url": url, "attempt": attempt + 1})
        raise ProviderError("checksum_mismatch", f"checksum mismatch for {url.rsplit('/', 1)[-1]}")

    def _download(self, url: str) -> bytes | None:
        for attempt in range(MAX_HTTP_ATTEMPTS):
            try:
                response = self.client.get(url, timeout=ARCHIVE_TIMEOUT_S)
            except httpx.TransportError as exc:
                self._backoff(attempt, f"archive transport error: {exc}")
                continue
            if response.status_code == 404:
                return None
            if response.status_code == 200:
                return response.content
            if response.status_code in (429, 418) or response.status_code >= 500:
                self._backoff(attempt, f"archive HTTP {response.status_code}", response)
                continue
            raise ProviderError("archive_http_error", f"archive HTTP {response.status_code}", retryable=False)
        raise ProviderError("provider_unavailable", "binance archive host kept failing")

    def fetch_rest(self, spec: InstrumentSpec, start_ms: int, end_ms: int) -> Candles:
        market = self._market(spec)
        hosts = [self.futures_host] if market is FUTURES else self.rest_hosts
        end = closed_end(end_ms, self.now_ms())
        pages: list[Candles] = []
        cursor = start_ms
        while cursor < end:
            self.throttle()
            rows = self._get_json(
                hosts,
                market,
                {"symbol": spec.provider_id, "interval": "1m", "startTime": cursor, "endTime": end - 1, "limit": market.page_limit},
            )
            if not rows:
                break
            page = parse_kline_rows(rows)
            pages.append(page)
            if len(rows) < market.page_limit:
                break
            cursor = int(page.ts[-1]) + MINUTE_MS
        candles = Candles.concat(*pages)
        return candles.take(candles.ts + MINUTE_MS <= end)

    def _get_json(self, hosts: list[str], market: _Market, params: dict) -> list:
        key = ",".join(hosts)
        blocked: set[str] = set()
        index = self._preferred.get(key, 0)
        last_error = "no attempt"
        for attempt in range(MAX_HTTP_ATTEMPTS):
            live = [h for h in hosts if h not in blocked]
            if not live:
                raise ProviderError("region_blocked", "binance REST is unavailable from this region (HTTP 451)", retryable=False)
            host = live[index % len(live)]
            try:
                response = self.client.get(host + market.rest_path, params=params, timeout=REST_TIMEOUT_S)
            except httpx.TransportError as exc:
                last_error = f"{host}: {exc.__class__.__name__}"
                index += 1
                if index % len(live) == 0:
                    self._backoff(attempt, last_error)
                continue
            status = response.status_code
            if status == 451:
                blocked.add(host)
                last_error = f"{host}: HTTP 451"
                logger.warning("binance host region-blocked, trying alternate", extra={"host": host})
                continue
            if status in (429, 418):
                last_error = f"{host}: HTTP {status}"
                self._backoff(attempt, last_error, response)
                continue
            if status >= 500:
                last_error = f"{host}: HTTP {status}"
                self._backoff(attempt, last_error)
                continue
            if status != 200:
                raise ProviderError("bad_request", f"binance REST HTTP {status}: {response.text[:200]}", retryable=False)
            self._preferred[key] = hosts.index(host)
            self._pace(response, market)
            return response.json()
        raise ProviderError("provider_unavailable", f"binance REST failed after retries ({last_error})")

    def _pace(self, response: httpx.Response, market: _Market) -> None:
        try:
            used = int(response.headers.get(WEIGHT_HEADER, "0"))
        except ValueError:
            return
        if used >= 0.8 * market.weight_limit:
            wait = 60 - (self.now_ms() / 1000) % 60 + 1
            logger.info("binance weight high, pausing", extra={"used_weight": used, "wait_s": round(wait, 1)})
            self.sleep(wait)

    def _backoff(self, attempt: int, reason: str, response: httpx.Response | None = None) -> None:
        retry_after = None
        if response is not None:
            try:
                retry_after = float(response.headers.get("retry-after", ""))
            except ValueError:
                retry_after = None
        if attempt >= MAX_HTTP_ATTEMPTS - 1:
            if response is not None and response.status_code in (429, 418):
                raise ProviderError("rate_limited", reason, retry_after_s=retry_after)
            return
        delay = retry_after if retry_after is not None else min(60.0, 2.0**attempt)
        delay += random.uniform(0, 0.25 * max(delay, 1.0))
        logger.warning("binance backing off", extra={"reason": reason, "delay_s": round(delay, 2)})
        self.sleep(delay)

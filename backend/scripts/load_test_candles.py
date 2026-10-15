"""20-user mix against a running API. This does not start the server.

From backend/:
  python -m scripts.load_test_candles --base-url http://127.0.0.1:8000 --duration 30

It signs up (or logs in) one user per worker, then for the duration mixes candle
windows, a replay payload when a journal trade exists, and session autosave.
Results are written to scripts/load-test-results.json. A separate gzip check
reads the account CSV export with and without gzip.
"""

from __future__ import annotations

import argparse
import json
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

PASSWORD = "load-test-pass-1"
RESULTS = Path(__file__).with_name("load-test-results.json")


def _percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((pct / 100) * (len(ordered) - 1)))))
    return ordered[index]


def _auth(client: httpx.Client, base: str, index: int) -> str:
    email = f"loadtest-{index}@example.com"
    body = {"email": email, "password": PASSWORD, "name": f"Load {index}"}
    signup = client.post(base + "/api/auth/signup", json=body)
    if signup.status_code == 200:
        return signup.json()["access_token"]
    login = client.post(base + "/api/auth/login", json={"email": email, "password": PASSWORD})
    login.raise_for_status()
    return login.json()["access_token"]


def _summarize(samples: list[dict]) -> dict:
    by_endpoint: dict[str, list[dict]] = {}
    for sample in samples:
        by_endpoint.setdefault(sample["endpoint"], []).append(sample)
    summary = {}
    for endpoint, rows in sorted(by_endpoint.items()):
        elapsed = [row["seconds"] for row in rows]
        sizes = [row["bytes"] for row in rows]
        errors = [row["status"] for row in rows if row["status"] == 0 or row["status"] >= 400]
        summary[endpoint] = {
            "count": len(rows),
            "errors": len(errors),
            "statuses": sorted(set(row["status"] for row in rows)),
            "p50_s": _percentile(elapsed, 50),
            "p95_s": _percentile(elapsed, 95),
            "p99_s": _percentile(elapsed, 99),
            "bytes_p50": _percentile([float(size) for size in sizes], 50),
            "bytes_max": max(sizes) if sizes else 0,
        }
    return summary


def _gzip_check(client: httpx.Client, base: str, token: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    accounts = client.get(base + "/api/accounts", headers=headers)
    if accounts.status_code != 200 or not accounts.json():
        return {"checked": False, "reason": f"accounts status {accounts.status_code}"}
    account_id = accounts.json()[0]["id"]
    path = f"/api/accounts/{account_id}/export"
    plain = client.get(base + path, headers={**headers, "Accept-Encoding": "identity"})
    gzipped = client.get(base + path, headers={**headers, "Accept-Encoding": "gzip"})
    return {
        "checked": True,
        "plain_status": plain.status_code,
        "gzip_status": gzipped.status_code,
        "plain_bytes": len(plain.content),
        "gzip_decoded_bytes": len(gzipped.content),
        "bodies_match": plain.content == gzipped.content,
        "content_encoding": gzipped.headers.get("content-encoding"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--duration", type=float, default=30)
    parser.add_argument("--symbol", default="BTCUSDT")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    samples: list[dict] = []
    samples_lock = threading.Lock()
    deadline = time.perf_counter() + args.duration

    def record(row: dict) -> None:
        with samples_lock:
            samples.append(row)

    def worker(index: int, token: str) -> None:
        del index
        with httpx.Client(timeout=30) as client:
            headers = {"Authorization": f"Bearer {token}"}
            session_id = None
            trade_id = None
            trades = client.get(base + "/api/trades?limit=1", headers=headers)
            if trades.status_code == 200 and trades.json():
                payload = trades.json()
                first = payload[0] if isinstance(payload, list) else payload.get("items", [None])[0]
                if isinstance(first, dict):
                    trade_id = first.get("id")
            created = client.post(
                base + "/api/backtest/sessions",
                headers=headers,
                json={
                    "symbol": args.symbol,
                    "timeframe": "1m",
                    "start_ms": 1788220800000,
                    "end_ms": 1788307200000,
                    "initial_balance": 10000,
                },
            )
            if created.status_code == 201:
                session_id = created.json().get("id")
            else:
                record({"endpoint": "session_create", "status": created.status_code, "seconds": 0, "bytes": len(created.content)})
            step = 0
            while time.perf_counter() < deadline:
                kind = step % 3
                step += 1
                if kind == 0:
                    path = f"/api/market-data/candles?symbol={args.symbol}&timeframe=1m&start=2026-09-01T00:00:00Z&end=2026-09-01T08:00:00Z"
                    endpoint = "candles"
                elif kind == 1 and trade_id:
                    path = f"/api/trades/{trade_id}/replay"
                    endpoint = "replay"
                elif session_id:
                    started = time.perf_counter()
                    response = client.put(
                        base + f"/api/backtest/sessions/{session_id}/state",
                        headers=headers,
                        json={"cursor_ms": 1788220800000 + step * 60_000, "notes": "load"},
                    )
                    record({
                        "endpoint": "session_autosave",
                        "status": response.status_code,
                        "seconds": time.perf_counter() - started,
                        "bytes": len(response.content),
                    })
                    time.sleep(0.55)
                    continue
                else:
                    path = f"/api/market-data/candles?symbol={args.symbol}&timeframe=5m&start=2026-09-02T00:00:00Z&end=2026-09-02T12:00:00Z"
                    endpoint = "candles"
                started = time.perf_counter()
                response = client.get(base + path, headers=headers)
                record({
                    "endpoint": endpoint,
                    "status": response.status_code,
                    "seconds": time.perf_counter() - started,
                    "bytes": len(response.content),
                })
                time.sleep(0.55)

    try:
        with httpx.Client(timeout=20) as probe:
            probe.get(base + "/api/health").raise_for_status()
    except httpx.HTTPError as exc:
        print(f"load test could not reach the API: {exc}")
        return 2
    tokens: list[str] = []
    with httpx.Client(timeout=30) as client:
        for index in range(args.users):
            try:
                tokens.append(_auth(client, base, index))
            except httpx.HTTPError as exc:
                print(f"could not authenticate loadtest-{index}@example.com: {exc}")
                return 1
    with ThreadPoolExecutor(max_workers=args.users) as pool:
        list(pool.map(lambda index: worker(index, tokens[index]), range(args.users)))
    gzip = {"checked": False, "reason": "auth failed"}
    try:
        with httpx.Client(timeout=30) as client:
            token = _auth(client, base, 0)
            gzip = _gzip_check(client, base, token)
    except httpx.HTTPError as exc:
        gzip = {"checked": False, "reason": str(exc)}
    summary = _summarize(samples)
    report = {"users": args.users, "duration_s": args.duration, "base_url": base, "endpoints": summary, "gzip": gzip}
    RESULTS.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    errors = sum(item["errors"] for item in summary.values())
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

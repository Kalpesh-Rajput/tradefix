"""20-user candle read against a running API. This is a NET check; it does not start the server.

Usage (from backend/): python -m scripts.load_test_candles --base-url http://127.0.0.1:8000 --token <jwt>
"""

from __future__ import annotations

import argparse
import statistics
import time
from concurrent.futures import ThreadPoolExecutor

import httpx


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--token", default="")
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--symbol", default="BTCUSDT")
    args = parser.parse_args()
    headers = {"Authorization": f"Bearer {args.token}"} if args.token else {}
    path = f"/api/market-data/candles?symbol={args.symbol}&timeframe=1m&limit=500"

    def once() -> tuple[int, float]:
        started = time.perf_counter()
        response = httpx.get(args.base_url + path, headers=headers, timeout=30)
        return response.status_code, time.perf_counter() - started

    try:
        with ThreadPoolExecutor(max_workers=args.users) as pool:
            samples = list(pool.map(lambda _i: once(), range(args.users)))
    except httpx.HTTPError as exc:
        print(f"load test could not reach the API: {exc}")
        return 2
    statuses = [status for status, _elapsed in samples]
    elapsed = sorted(sample[1] for sample in samples)
    p95 = elapsed[max(0, int(len(elapsed) * 0.95) - 1)]
    print(f"users={args.users} statuses={set(statuses)} p95_s={p95:.3f} median_s={statistics.median(elapsed):.3f}")
    if any(status >= 500 for status in statuses):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

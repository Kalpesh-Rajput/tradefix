# Backtesting: Human QA Checklist

Every [HUMAN] check from `05_TESTING_AND_ACCEPTANCE.md` and `PLAN.md`, grouped by phase. Only the user ticks these boxes. The agent mirrors open items in `PROGRESS.md` under "Pending human verification".

**Setup for all checks**

1. Start the API with `uvicorn app.main:app --port 8001` from `backend/`.
2. Start the worker with `python -m app.workers.market_worker`.
3. Start the frontend with `npm run dev` from `frontend/`.
4. Seed the market data with `python -m app.cli.marketdata seed-demo`.
5. Create journal trades that fall inside the seeded month: forex (EURUSD), metal (XAUUSD), and crypto (BTCUSDT).

---

## Phase 1: Data foundation

These items are [NET] and the agent attempts them first. They appear here so you can run them if the agent could not.

- [ ] Run the live provider smoke tests with `pytest -m live tests/test_providers.py` (from `backend/`). Check that BTC and EURUSD prices fall within broad sanity ranges.
- [ ] Run `python -m app.cli.marketdata verify-instrument BTCUSDT EURUSD XAUUSD --write`. Check that `instruments.yaml` shows `verified_on` dates and `enabled: true` for all three.
- [ ] Run `seed-demo`, then `python -m app.cli.marketdata coverage`. Check that all three instruments cover the whole month. Expected row counts: crypto about 43,000 to 44,640, forex about 28,000 to 32,000, with no unexplained gaps.
- [ ] Cross-check: stored BTCUSDT daily closes match Binance daily klines, and EURUSD daily closes match a public reference, within the documented tolerance.
- [ ] **F4 NEEDS-HUMAN:** import one full month of EURUSD and one full month of XAUUSD from a file you have the right to use. From `backend/`: `python -m app.cli.marketdata import-candles EURUSD <file-or-folder> --preset dukascopy --label "Dukascopy manual export" --price-side bid` (use `--preset histdata` for a HistData file). Then `python -m app.cli.marketdata verify-instrument EURUSD --stored` and read each PASS/FAIL line. Repeat for XAUUSD. Add `--gaps-reviewed --write` only after you have read the gap report and every other check passed. Until then both instruments stay disabled.
- [ ] **F4 NEEDS-NETWORK:** from a network that is not challenged, run `python -m app.cli.marketdata verify-instrument EURUSD --write` once. If the log shows HTTP 202 or a challenge page, stop. Do not retry in a loop. The cool-down is 6 hours.
- [ ] **F5 NEEDS-NETWORK:** one live BTCUSDT cross-check. From `backend/`, run the cross-check job for yesterday (or `python -c` calling `run_crosscheck` for BTCUSDT and yesterday). A single request to `api.binance.com` on 2026-10-15 failed with an SSL EOF before any kline was read, so this is still open. Do not treat a forex row as checked until F4 import has stored a month.

## Phase 2: Trade Replay

- [ ] **2D chart lifecycle:** in `npm run dev` (StrictMode on), open the replay page. DevTools shows exactly one chart canvas per chart. There are no console errors or warnings. Resizing the window resizes the chart. Switching light and dark redraws it in the right colours.
- [ ] **2F page shell:** a seeded trade's replay loads with a skeleton first. The preparing, unresolved and error states each render clearly; trigger them with an unseeded date, an unknown symbol, and the API stopped.

The steps below are from 05 section 4.

1. [ ] Open a forex trade and a crypto trade and press Replay. Check that the candles, the entry and exit markers, and the SL and TP lines appear at the right times and prices.
2. [ ] Play at each speed, then pause, step forward and back, scrub, and jump to entry and exit.
3. [ ] Switch timeframes at least five times mid-replay and check continuity: no jumps, no duplicate candles, and no future candles.
4. [ ] Add a note and reload. Check that it persists and that clicking it jumps to its time.
5. [ ] Open a trade outside seeded coverage. Check that the preparing state resolves on its own and the trade then replays.
6. [ ] Open a trade with an unresolvable symbol. Check that the message is clear and that "request support" records interest.
7. [ ] Check light and dark themes, and a narrow window (tablet and mobile width).

- [ ] **Time offsets (2A):** for an account with server-time trades, the replay entry candle contains the entry price. The admin time-offset report shows that account's chosen offset and confidence.

## Phase 3: Manual backtesting

- [ ] **3D hub:** the tabs Manual Sessions, Strategies, Runs and Setup Lab all work. Setup Lab shows the same expectancy table as the old `/backtest` page. The setup form shows validation messages for bad dates, balance and costs.

The steps below are from 05 section 5, Phase 3.

1. [ ] Create one session on BTCUSDT and one on EURUSD. Place market, limit and stop orders with SL and TP, and watch them trigger.
2. [ ] Pause, reload the browser, and resume. Check that positions, orders, balance and the chart continue exactly where they were.
3. [ ] Check that step back is disabled while a position or pending order is open.
4. [ ] Finish the session. Check that the summary equals the server-recomputed stats, and that each trade opens in replay (`/replay/session/...`). Check that the URL contains only ids.
5. [ ] Check that no session trades appear in the live journal, the dashboard, the analytics page, exports, or AI assistant answers.

## Phase 4: Automated backtesting

- [ ] **4E builder / F1 NEEDS-NETWORK:** with the API, worker and frontend running and BTCUSDT seeded, run each of the three templates over the seeded month. Confirm the run page shows a non-zero bar count and a plausible trade count. Commands, from `backend/` with the venv python: `python -m app.cli.marketdata coverage BTCUSDT`, then in the app open `/backtest/strategies/new`, pick each template, set the seeded month, and run it.
- [ ] **4E builder:** the three starter templates fill the form, validate, save and run. Each field error shows next to its field.

The steps below are from 05 section 5, Phase 4.

1. [ ] Build the three starter strategies, then validate, save and run each over the seeded month. Repeat over a longer range once it is backfilled.
2. [ ] Watch the queued, running and completed states. Cancel one run mid-way.
3. [ ] For one run, export or copy the trades table into a spreadsheet and recompute the net profit, win rate, profit factor, expectancy in R and max drawdown. They must match the KPI cards.
4. [ ] Open several trades in replay (`/replay/run/...`). Check that the entry and exit markers match the table.
5. [ ] Trigger each validation error and each quota or limit error. Check that every message is clear.

## Phase 5: Hardening

- [ ] **5B admin page:** run `python -m app.cli.marketdata make-admin <your email>`, then open `/admin/data-status`. Check that coverage, gaps and the failures list are accurate and that retry works. Check that a non-admin user cannot open the page.
- [ ] **Performance feel:**
  - Replay at 10x and 50x is smooth.
  - Memory does not grow over 10 minutes (DevTools Performance and Memory panels).
  - A timeframe switch feels under 1 second.
- [ ] **5D fresh checkout:** on a clean clone, follow README_BACKTESTING exactly: migrate, `make-admin`, seed, then start the API, worker and frontend. Use each feature once.
- [ ] **Final sign-off:** every criterion in 05 section 8 holds, and FINAL_REPORT lists no unexplained gaps.

# 04: Frontend Specification

Pages, components, replay engine behaviour and UI states. Reuse the app's existing framework, router, UI library, data-fetching layer and design tokens (found in the Phase 0 audit). The look must match the premium style of the existing analytics page: consistent spacing, typography, cards, and smooth animation that never blocks interaction.

## 1. Routes and navigation

| Route (indicative) | Page |
|---|---|
| Trade detail → "Replay" button | Opens the Trade Replay page for that trade |
| Replay of a trade | Trade Replay viewer |
| Backtesting hub | Tabs: **Manual Sessions**, **Strategies**, **Backtest Runs** |
| New manual session | Setup form |
| Manual session | Session simulator (new and resumed) |
| Strategy new and edit | Strategy builder |
| Backtest run | Results page |
| Admin data status | Operational view (admin only) |

Add a **Backtesting** item to the existing navigation. Gate every page through the feature access check from document 01 (allowed for everyone for now).

## 2. Shared chart component

One reusable component wraps TradingView Lightweight Charts. Every viewer uses it; no page touches the library directly.

Requirements:
- **Detect the installed Lightweight Charts major version** and use the matching API for creating series, markers and price lines. Record the version in DECISIONS.md.
- Candlestick series, optional volume histogram (off by default for forex), crosshair with a legend (OHLC and time), time scale in the **user's timezone** with a UTC toggle, price scale with the instrument's decimals.
- **Theme-aware:** light and dark from the app's tokens, redrawn when the theme changes.
- **Responsive:** resizes with its container, usable on tablet width, sensible on mobile (controls collapse).
- **Imperative API:** set history, append or update the last candle, set markers, add, update and remove horizontal price lines (entry, SL, TP, pending orders), scroll to a time, fit content.
- **Performance:** never re-render the whole chart per tick; update only the last candle. Limit the in-memory history to a configured number of bars and trim old bars when exceeded.
- **Attribution:** show the notice required by the library licence (small footer text or link) and add it to the app's licence or notices page.

## 3. Replay engine (framework-agnostic TypeScript module)

A pure module with no UI imports so it can be unit tested. It owns time, buffers and candle building. The UI subscribes to its events.

### 3.1 Concepts
- **Cursor time:** the replay "now". Nothing after the cursor is ever rendered.
- **Base data:** 1-minute candles. The engine advances the cursor one 1-minute candle per step.
- **Display timeframe:** the user's chosen timeframe. The engine builds the **forming candle** of the display timeframe by merging each new 1-minute candle (open from the first minute of the bucket, running high and low, close from the latest minute), and emits "update last candle" or "new candle" events.
- **Speed:** steps per second, selectable (1, 2, 5, 10, 20, 50, 100 minutes of market time per second, plus "1 display candle per second"). Use a time-based loop that stays accurate under tab throttling (catch up in bounded batches rather than drift).

### 3.2 Buffers
- **History buffer** at the display timeframe (complete candles before the cursor's bucket), fetched from the server with the "until" cutoff.
- **Forward buffer** of 1-minute candles ahead of the cursor, fetched in chunks (default 1,500 minutes). Prefetch the next chunk when the buffer falls below a threshold. If the buffer empties before the next chunk arrives, **pause automatically and show a short "loading" indicator**, then resume.
- When data ends (end of available data or session limit), stop and show an end-of-data message.

### 3.3 Operations
- **Play, pause, step forward one minute, step forward one display candle.**
- **Step back:** rebuild state to the earlier time: history from the server with the new cutoff, plus the forming candle rebuilt from 1-minute data. Allowed in Trade Replay; **disabled in manual sessions** with open orders or positions (stepping back would corrupt the simulation); allowed after finishing.
- **Seek (scrub, jump to entry, jump to exit):** same rebuild routine as step back.
- **Timeframe switch (the critical algorithm):**
  1. Pause.
  2. Compute the bucket start of the cursor time at the new timeframe.
  3. Fetch history for the new timeframe with the cutoff at that bucket start (complete candles only).
  4. Fetch the 1-minute candles from the bucket start up to the cursor and build the partial forming candle.
  5. Replace the chart data atomically and keep the cursor unchanged.
  6. Resume if it was playing.
  No future 1-minute data beyond the cursor may appear in any rebuilt candle.
- **Reset to start.**

### 3.4 Guarantees (tested)
- Rendered data never contains anything later than the cursor.
- The final candle at any timeframe equals the server's aggregated candle for the same bucket once the bucket closes.
- Pause, play and seek sequences never duplicate or skip candles.

## 4. Trade Replay page

**Layout:** header with trade summary (symbol, side, size, entry and exit time and price, result in R and pips, duration); main chart; control bar below the chart; right panel (collapsible on small screens) with notes and trade details.

**Controls:** play and pause, step back and forward, speed selector, timeframe selector (1m to 1d), scrub slider across the replay window, "jump to entry", "jump to exit", reset, fullscreen.

**Chart overlays (from the replay payload):**
- Entry and exit markers (direction arrows with price labels), appearing **only when the cursor reaches them**.
- Horizontal lines for entry, stop loss (red) and take profit (green), appearing from the entry time.
- A live **floating result badge** (pips and R, plus currency value when convertible) computed from the replayed price versus entry while the trade is open, and the final result after exit.
- Optional shaded region between entry and exit once exited.

**Notes:** the user can add a note at the current replay time. Notes show as small markers on the time axis and in the right panel list; clicking a note jumps to its time. Notes persist through the notes endpoint.

**Price alignment banner:** when the payload contains an offset suggestion, show a dismissible banner: "Prices come from reference market data and differ slightly from your broker." Offer an **Align to my fills** toggle that shifts displayed prices by the suggested offset (display only, never stored), default off.

**Initial state:** cursor placed at the suggested start; paused; the user presses play.

**What-if (stretch, build only after everything else passes):** allow dragging or editing hypothetical SL and TP and show whether the trade would have won; clearly labelled hypothetical.

## 5. Manual Session pages

### 5.1 Setup form
Instrument picker (searchable, grouped by asset class, shows data availability range), start date and time (validated against available data), initial balance, default timeframe, spread (pips), commission per lot, and a short explanation of the rules (fills at the next candle open, conservative SL-first on ambiguity).

### 5.2 Simulator layout
Chart (shared component) with replay controls; **order ticket** on the side; tabs below for **Positions**, **Pending orders**, **History**, **Stats**; top bar showing balance, equity, floating P&L, session name, and a **Finish** button.

**Order ticket:** buy and sell buttons showing the current price; order type (market, limit, stop); size input in lots (or units for crypto) with an optional **risk-based sizing helper** (enter risk percent, SL distance, and it suggests the size); SL and TP inputs in price, pips, or R multiple; validation messages (SL on the wrong side of price, size too large for balance, etc.). Clicking the chart can fill a price field (stretch: draggable lines).

**Behaviour:**
- The replay controls work as in document 04 section 3, with manual-session restrictions on stepping back.
- Orders and positions render as horizontal lines on the chart (entry, SL, TP, pending), updating as they change.
- Positions can be closed manually, partially in v2 (not built), and their SL and TP edited while open.
- Autosave on pause, every 15 seconds while playing, on tab hide, and on finish, via the session endpoints with client-generated ids so retries are safe. Show a subtle "saved" or "saving failed, retrying" indicator.
- **Finish:** confirms, closes open positions at the current price with exit reason "session end", calls the finish endpoint, then shows the **summary** (stats, equity curve, trades list with "view in replay" for each trade).
- **Resume** from the Manual Sessions list restores everything as described in document 03 section 6.

### 5.3 Manual Sessions list
Cards or table with symbol, date range, balance, net result, number of trades, status, last activity; actions: resume, view summary, rename, delete.

## 6. Strategy builder

A guided form, not a code editor.

- **Sections:** Market (instrument, timeframe, date range with a data-availability hint), Direction, Entry rules, Exit rules (stop loss, take profit, optional exits), Filters, Risk and costs.
- **Rule editor:** rows of condition cards (left operand, operator, right operand) grouped with an All/Any toggle; operand pickers for price field, indicator (with parameter inputs and output line choice) and constant; add, remove and reorder rows; plain-language preview sentence for each condition (for example "RSI(14) crosses below 30").
- **Live validation:** call the validate endpoint (debounced) and show field-level errors and the estimated bar count against the cap.
- **Save, duplicate, delete** strategies; a template picker with a few starter strategies (moving-average crossover, RSI mean reversion, Bollinger breakout) that fill the form; these are **form presets, not stored results**.
- **Run:** starts a backtest and navigates to the run page.

## 7. Backtest run and results pages

**Run status:** while queued or running, show progress with the job's messages (loading data, computing indicators, simulating), a cancel button, and automatic polling with sensible backoff. If data is still being prepared for the range, show "Preparing market data" with its progress.

**Results page sections:**
1. **Header:** strategy name, instrument, timeframe, range, run duration, and a warnings banner (from the result warnings).
2. **KPI cards:** net profit, return, trades, win rate, profit factor, expectancy in R, max drawdown, average R, with animated number transitions.
3. **Equity curve** with drawdown below it (lightweight chart or the app's chart library, whichever the existing analytics page uses for line charts).
4. **Monthly returns heatmap**, **R-multiple distribution**, **breakdown by weekday and by hour**.
5. **Trades table:** virtualized, sortable and filterable, with columns for time, side, entry and exit, pips, R, result, bars held, exit reason; each row has **Open in Replay**.
6. Actions: re-run with edited strategy, duplicate strategy, delete run.

**Open in Replay for a backtest trade:** opens the replay viewer in a mode that takes the instrument, timeframe and the trade's entry and exit data directly (the same overlays as Trade Replay), without needing a journal trade. Implement this by making the replay viewer accept either a journal trade id or an explicit simulated-trade descriptor.

## 8. Backtest Runs list
Table of runs with strategy, instrument, range, status, net result, win rate, drawdown, created time; actions: open, delete; optional **compare** of two runs side by side (stretch).

## 9. Admin data status page
Table of instruments with covered range, last update, gap summary and status badge; a failures list with messages and a retry button; an "enqueue backfill" form (instrument and range); alias management and the top unresolved symbols list. Visible to admins only.

## 10. States every page must handle

| State | UI |
|---|---|
| Loading | Skeletons matching the layout, never a blank screen |
| Data preparing | Progress panel with message, polling, cancel where relevant |
| Symbol unresolved | Clear explanation and a "request support for this symbol" action that records interest |
| Data unavailable | Friendly error with retry |
| Quota exceeded | Message stating the limit and when it resets |
| Rate limited | Short wait notice and automatic retry |
| Network error | Retry button; autosave indicator shows failure and retries in the background |
| Empty lists | Helpful empty states with a primary action |
| Unauthorized or feature denied | Existing app pattern |

## 11. Performance, accessibility and quality

- Replay updates must stay smooth at the highest speed: batch events per animation frame, avoid framework re-renders on every minute step (update imperative chart and a throttled React/Vue state for readouts).
- Virtualize long tables. Memoize heavy panels. Debounce validation calls.
- Keyboard shortcuts for replay (space to play and pause, arrow keys to step, plus and minus for speed) with a visible shortcut hint, disabled while typing in inputs.
- Accessible labels on all controls, sufficient colour contrast, visible focus states, no colour-only meaning (use icons or labels for win and loss).
- Internationalization follows the app's existing approach. Dates and numbers use the user's locale.
- No console errors or warnings in normal use.

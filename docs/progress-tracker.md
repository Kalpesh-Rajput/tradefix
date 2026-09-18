# Progress Tracker

Discipline and habit tracking for TradeFix. It scores whether the trader followed their own rules — not P&L.

## Architecture

```
Rule configuration (settings + version snapshots)
        ↓
Rule evaluation engine (pure functions)
        ↓
Daily rule results (persisted per user/date/account scope)
        ↓
Streak, heatmap, follow rate, checklist
```

Frontend never computes scores. React Query loads `/api/progress-tracker/summary` and mutations invalidate `["progress-tracker"]`. Trade create/update/delete and journal writes re-evaluate the affected dates on the server.

## Database

| Table | Role |
| --- | --- |
| `progress_tracker_settings` | Current user config (one row per user) |
| `progress_tracker_config_versions` | Snapshots with `effective_from`. Rule edits apply from today forward. |
| `progress_tracker_manual_rules` | Custom habits. Soft-deleted so historical completions stay meaningful. |
| `progress_tracker_manual_completions` | Unique `(user_id, rule_id, date)` |
| `progress_tracker_day_starts` | Idempotent “start my day” timestamp |
| `progress_tracker_daily_results` | Cached evaluation for a date + optional account filter |

All rows are scoped by `user_id`. APIs never trust a client-supplied user id.

## Timezone

Every date boundary uses `users.timezone` via `zoneinfo`. Fallback is `UTC` if the stored zone is invalid. Trading hours, start-my-day, daily loss, heatmap, and streak all use that zone — never the server’s local time.

## Rule engine

`app/services/progress_rule_engine.py` is pure. Add a future rule by:

1. Writing `evaluate_<name>(...)` that returns a `RuleResult`.
2. Registering it in `builtin_evaluators()`.
3. Adding an enable flag + condition fields on settings (and the settings snapshot).
4. Exposing the toggle in `EditRulesModal`.

Statuses: `passed`, `failed`, `pending`, `not_applicable`.

Score = passed / (passed + failed + pending). `not_applicable` and non-trading days are excluded. Future dates are never failed.

### Built-in rules

- **Trading hours** — each trade’s `opened_at` (user TZ) must fall in `[from, to)`. Overnight windows (`from > to`) are allowed.
- **Start my day by** — earliest of Progress Tracker day start, daily check-in, recap, or day note vs the configured local time. Missing today = pending; missing past = failed.
- **Link trades to playbook** — every trade that day has `playbook_id`.
- **Stop loss** — every trade that day has `stop_loss`.
- **Max loss / trade** — closed-trade `pnl` vs amount or `%` of `account.initial_balance`.
- **Max loss / day** — sum of closed-trade `pnl` for the day (canonical stored P&L).

No trades → `not_applicable` for trade-derived rules.

### Manual rules

Schedule is a weekday list (`mon`…`sun`). Completing a checkbox upserts `progress_tracker_manual_completions`. Past incomplete = failed; today incomplete = pending.

## Streak

Consecutive **configured trading days** on which the user started a day (any of the participation sources above). Disabled weekdays are skipped, so Friday → Monday can continue a streak.

## Heatmap

Rendered from stored/evaluated daily scores for the selected range (capped at ~400 days). Empty cells mean no tracking, not 0%. Clicking a day loads that day's checklist on this page. Use **Open My Day** for `/my-day?date=YYYY-MM-DD`. Today also calls `POST /api/progress-tracker/start-day` (idempotent) when a day is started from My Day.

## API

All under `/api/progress-tracker`, authenticated.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/settings` | Lazy-create defaults (Mon–Fri, rules off) |
| PUT | `/settings` | Save config + manual rules; new version effective today |
| GET | `/summary` | Streak, period score, checklist, heatmap, rule analytics |
| GET | `/daily/{date}` | One day’s evaluation |
| POST | `/start-day` | Idempotent start; also creates a `daily_checkins` row if missing |
| PUT | `/manual-rules/{id}/completion` | Toggle a habit for a date |
| POST | `/reset` | Deletes results, completions, day starts. Keeps rules. |

`account_id` is optional. Omit it for all accounts. Trade-level rules filter to that account; user-level rules (start day, habits, trading days) stay global.

## Reminders

`reminder_enabled` + `reminder_time` are persisted. `progress_notifications.deliver_streak_reminder` is the delivery hook. There is no mailer yet; the scheduler logs due reminders hourly.

## Tests

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest tests/test_progress_rule_engine.py tests/test_trade_calc.py tests/test_stats_service.py tests/test_playbook_validation.py tests/test_progress_reevaluate.py -q
```

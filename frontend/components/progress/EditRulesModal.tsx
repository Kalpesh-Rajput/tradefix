"use client";

import clsx from "clsx";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import type {
  ManualRuleDraft,
  ProgressSettings,
  ProgressSettingsPayload,
  Weekday,
} from "@/lib/progress-tracker/types";
import { WEEKDAYS, WEEKDAY_PRESETS, schedulePresetId } from "@/lib/progress-tracker/types";

function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[13px] font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-[var(--color-border)]"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

type SettingsForm = Omit<ProgressSettingsPayload, "manual_rules">;

function timeOptions() {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

const TIMES = timeOptions();

function toDraft(settings: ProgressSettings): {
  form: Omit<ProgressSettingsPayload, "manual_rules">;
  rules: ManualRuleDraft[];
} {
  return {
    form: {
      active_days: settings.active_days,
      reminder_enabled: settings.reminder_enabled,
      reminder_time: settings.reminder_time,
      trading_hours_enabled: settings.trading_hours_enabled,
      trading_start_time: settings.trading_start_time,
      trading_end_time: settings.trading_end_time,
      start_day_enabled: settings.start_day_enabled,
      start_day_time: settings.start_day_time,
      link_playbook_enabled: settings.link_playbook_enabled,
      stop_loss_required: settings.stop_loss_required,
      max_loss_per_trade_enabled: settings.max_loss_per_trade_enabled,
      max_loss_per_trade_mode: settings.max_loss_per_trade_mode,
      max_loss_per_trade_value: settings.max_loss_per_trade_value,
      max_loss_per_day_enabled: settings.max_loss_per_day_enabled,
      max_loss_per_day_value: settings.max_loss_per_day_value,
    },
    rules: settings.manual_rules.map((r) => ({
      id: r.id,
      clientId: r.id,
      name: r.name,
      schedule: r.schedule,
      sort_order: r.sort_order,
      is_active: r.is_active,
    })),
  };
}

export function EditRulesModal({
  open,
  settings,
  timezoneLabel,
  saving,
  resetting,
  onClose,
  onSave,
  onReset,
}: {
  open: boolean;
  settings: ProgressSettings | undefined;
  timezoneLabel: string;
  saving?: boolean;
  resetting?: boolean;
  onClose: () => void;
  onSave: (payload: ProgressSettingsPayload) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}) {
  const titleId = useId();
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [rules, setRules] = useState<ManualRuleDraft[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !settings) return;
    const next = toDraft(settings);
    setForm(next.form);
    setRules(next.rules);
    setError(null);
    setConfirmReset(false);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const payload: ProgressSettingsPayload | null = useMemo(() => {
    if (!form) return null;
    return {
      ...form,
      manual_rules: rules.map((r, i) => ({
        id: r.id,
        name: r.name.trim(),
        schedule: r.schedule,
        sort_order: i,
        is_active: r.is_active,
      })),
    };
  }, [form, rules]);

  if (!open || !form || typeof document === "undefined") return null;
  const current = form;

  function patch<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!payload) return;
    const named = payload.manual_rules.filter((r) => r.name.trim());
    if (payload.manual_rules.length !== named.length) {
      setError("Every manual rule needs a name.");
      return;
    }
    if (current.trading_hours_enabled && current.trading_start_time === current.trading_end_time) {
      setError("Trading hours need a start time different from the end time.");
      return;
    }
    setError(null);
    await onSave({ ...payload, manual_rules: named });
  }

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(820px,92vh)] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
          <h2 id={titleId} className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            Rules
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
            Changes apply to today and future days. Historical scores keep the rules that were active then.
          </p>

          <p className="text-[12px] font-medium text-[var(--color-text-primary)]">Trading days</p>
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">Days these rules should be active.</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => {
              const on = form.active_days.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on
                      ? form.active_days.filter((d) => d !== day.id)
                      : [...form.active_days, day.id];
                    if (!next.length) return;
                    patch("active_days", WEEKDAYS.map((d) => d.id).filter((id) => next.includes(id)));
                  }}
                  className={clsx(
                    "h-8 min-w-9 rounded-full px-2.5 text-[12px] font-medium",
                    on
                      ? "bg-primary text-on-accent"
                      : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                  )}
                >
                  {day.short}
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Toggle
                id="pt-reminder"
                checked={form.reminder_enabled}
                onChange={(v) => patch("reminder_enabled", v)}
                label="Send a reminder when I'm about to lose my streak"
                description="Saved now. Email delivery can be connected later without changing this setting."
              />
              <select
                value={form.reminder_time}
                onChange={(e) => patch("reminder_time", e.target.value)}
                disabled={!form.reminder_enabled}
                className="mb-3 h-8 w-[88px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                aria-label="Reminder time"
              >
                {TIMES.filter((t) => t.endsWith("0") || t.endsWith("5")).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Toggle
                id="pt-hours"
                checked={form.trading_hours_enabled}
                onChange={(v) => patch("trading_hours_enabled", v)}
                label="Trading hours"
                description={`Trades should open inside this window. Timezone: ${timezoneLabel}`}
              />
              <div className="mb-3 flex items-center gap-2 pl-0 sm:pl-0">
                <label className="text-[11px] text-[var(--color-text-muted)]">From</label>
                <input
                  type="time"
                  value={form.trading_start_time}
                  onChange={(e) => patch("trading_start_time", e.target.value)}
                  disabled={!form.trading_hours_enabled}
                  className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                />
                <label className="text-[11px] text-[var(--color-text-muted)]">To</label>
                <input
                  type="time"
                  value={form.trading_end_time}
                  onChange={(e) => patch("trading_end_time", e.target.value)}
                  disabled={!form.trading_hours_enabled}
                  className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Toggle
                id="pt-start"
                checked={form.start_day_enabled}
                onChange={(v) => patch("start_day_enabled", v)}
                label="Start my day by"
                description="Compared with the timestamp you start today's journal."
              />
              <input
                type="time"
                value={form.start_day_time}
                onChange={(e) => patch("start_day_time", e.target.value)}
                disabled={!form.start_day_enabled}
                className="mb-3 h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                aria-label="Start my day by time"
              />
            </div>

            <Toggle
              id="pt-playbook"
              checked={form.link_playbook_enabled}
              onChange={(v) => patch("link_playbook_enabled", v)}
              label="Link trades to playbook"
              description="Every trade opened on a trading day should have a playbook attached."
            />
            <Toggle
              id="pt-sl"
              checked={form.stop_loss_required}
              onChange={(v) => patch("stop_loss_required", v)}
              label="Input stop loss to all trades"
              description="Every trade opened on a trading day must include a stop loss."
            />

            <div>
              <Toggle
                id="pt-mlt"
                checked={form.max_loss_per_trade_enabled}
                onChange={(v) => patch("max_loss_per_trade_enabled", v)}
                label="Net max loss / trade"
                description="Fails if a closed trade's net loss exceeds this amount or percent of account balance."
              />
              <div className="mb-3 flex items-center gap-2">
                <div className="inline-flex rounded-md border border-[var(--color-border)] p-0.5">
                  <button
                    type="button"
                    className={clsx(
                      "h-7 min-w-8 rounded px-2 text-[12px]",
                      form.max_loss_per_trade_mode === "percent" ? "bg-primary text-on-accent" : "text-[var(--color-text-secondary)]"
                    )}
                    onClick={() => patch("max_loss_per_trade_mode", "percent")}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "h-7 min-w-8 rounded px-2 text-[12px]",
                      form.max_loss_per_trade_mode === "amount" ? "bg-primary text-on-accent" : "text-[var(--color-text-secondary)]"
                    )}
                    onClick={() => patch("max_loss_per_trade_mode", "amount")}
                  >
                    $
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step={form.max_loss_per_trade_mode === "percent" ? 0.1 : 1}
                  value={form.max_loss_per_trade_value}
                  onChange={(e) => patch("max_loss_per_trade_value", Number(e.target.value))}
                  disabled={!form.max_loss_per_trade_enabled}
                  className="h-8 w-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                  aria-label="Max loss per trade"
                />
              </div>
            </div>

            <div>
              <Toggle
                id="pt-mld"
                checked={form.max_loss_per_day_enabled}
                onChange={(v) => patch("max_loss_per_day_enabled", v)}
                label="Net max loss / day"
                description="Fails if total realized net P&L for the day exceeds this loss across the selected accounts."
              />
              <input
                type="number"
                min={0}
                step={1}
                value={form.max_loss_per_day_value}
                onChange={(e) => patch("max_loss_per_day_value", Number(e.target.value))}
                disabled={!form.max_loss_per_day_enabled}
                className="mb-3 h-8 w-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                aria-label="Max loss per day"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Manual rules</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Added to the daily checklist on matching days.</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary"
              onClick={() =>
                setRules((prev) => [
                  ...prev,
                  {
                    clientId: `new-${Date.now()}`,
                    name: "",
                    schedule: ["mon", "tue", "wed", "thu", "fri"],
                    sort_order: prev.length,
                    is_active: true,
                  },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add rule
            </button>
          </div>

          <ul className="mt-2 space-y-2">
            {rules.map((rule, index) => (
              <li
                key={rule.clientId}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex == null || dragIndex === index) return;
                  setRules((prev) => {
                    const next = [...prev];
                    const [moved] = next.splice(dragIndex, 1);
                    next.splice(index, 0, moved);
                    return next;
                  });
                  setDragIndex(null);
                }}
                className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5"
              >
                <span className="cursor-grab text-[var(--color-text-muted)]" aria-hidden>
                  <GripVertical className="h-4 w-4" />
                </span>
                <input
                  value={rule.name}
                  onChange={(e) =>
                    setRules((prev) => prev.map((r) => (r.clientId === rule.clientId ? { ...r, name: e.target.value } : r)))
                  }
                  placeholder="Rule name"
                  className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px]"
                  aria-label="Manual rule name"
                />
                <select
                  value={schedulePresetId(rule.schedule)}
                  onChange={(e) => {
                    const preset = WEEKDAY_PRESETS.find((p) => p.id === e.target.value);
                    if (!preset) return;
                    setRules((prev) =>
                      prev.map((r) => (r.clientId === rule.clientId ? { ...r, schedule: preset.days } : r))
                    );
                  }}
                  className="h-8 w-[108px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1 text-[12px]"
                  aria-label="Manual rule schedule"
                >
                  {WEEKDAY_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  {schedulePresetId(rule.schedule) === "custom" ? <option value="custom">Custom</option> : null}
                </select>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#D64545] hover:bg-red-50"
                  aria-label={`Delete ${rule.name || "rule"}`}
                  onClick={() => setRules((prev) => prev.filter((r) => r.clientId !== rule.clientId))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Reset your progress tracker</p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">
              Clears streak, daily scores, and habit check history. Rule configuration is kept. Trades, journals, accounts, and playbooks are not deleted.
            </p>
            {confirmReset ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={resetting}
                  onClick={async () => {
                    await onReset();
                    setConfirmReset(false);
                  }}
                >
                  {resetting ? "Resetting…" : "Confirm reset"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Keep history
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-2 inline-flex h-8 items-center rounded-md bg-[#D64545] px-3 text-[12px] font-medium text-white"
                onClick={() => setConfirmReset(true)}
              >
                Reset all progress
              </button>
            )}
          </div>
          {error ? <p className="mt-3 text-[12px] text-[#D64545]">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

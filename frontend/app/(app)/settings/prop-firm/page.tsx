"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsSelect,
  SettingsShell,
  SettingsToggle,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { usePropProfiles, usePropSettings, useUpsertPropSettings } from "@/lib/hooks/useProp";

export default function PropFirmSettingsPage() {
  const { activeAccount, accounts, setActiveAccountId, loading: accountsLoading } = useAccountPrefs();
  const toast = useToast();
  const accountId = activeAccount?.id;

  const { data: profiles = [] } = usePropProfiles();
  const { data: settings, isLoading } = usePropSettings(accountId, { enabled: !!accountId });
  const upsert = useUpsertPropSettings();

  const [profile, setProfile] = useState("custom");
  const [enabled, setEnabled] = useState(false);
  const [maxDaily, setMaxDaily] = useState("5");
  const [maxOverall, setMaxOverall] = useState("10");
  const [consistency, setConsistency] = useState("");
  const [minDays, setMinDays] = useState("0");
  const [warn, setWarn] = useState("80");
  const [danger, setDanger] = useState("90");

  useEffect(() => {
    if (!settings) {
      const p = profiles.find((x) => x.id === "custom") || profiles[0];
      if (p) {
        setProfile(p.id);
        setMaxDaily(String(p.max_daily_loss_pct));
        setMaxOverall(String(p.max_overall_drawdown_pct));
        setConsistency(p.consistency_rule_pct != null ? String(p.consistency_rule_pct) : "");
        setMinDays(String(p.min_trading_days ?? 0));
      }
      setEnabled(false);
      setWarn("80");
      setDanger("90");
      return;
    }
    setProfile(settings.profile);
    setEnabled(settings.enabled);
    setMaxDaily(String(settings.max_daily_loss_pct));
    setMaxOverall(String(settings.max_overall_drawdown_pct));
    setConsistency(
      settings.consistency_rule_pct != null ? String(settings.consistency_rule_pct) : ""
    );
    setMinDays(String(settings.min_trading_days ?? 0));
    setWarn(String(settings.warn_threshold_pct));
    setDanger(String(settings.danger_threshold_pct));
  }, [settings, profiles]);

  function applyProfileDefaults(id: string) {
    setProfile(id);
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setMaxDaily(String(p.max_daily_loss_pct));
    setMaxOverall(String(p.max_overall_drawdown_pct));
    setConsistency(p.consistency_rule_pct != null ? String(p.consistency_rule_pct) : "");
    setMinDays(String(p.min_trading_days ?? 0));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    try {
      await upsert.mutateAsync({
        account_id: accountId,
        profile,
        enabled,
        max_daily_loss_pct: Number(maxDaily),
        max_overall_drawdown_pct: Number(maxOverall),
        consistency_rule_pct: consistency.trim() ? Number(consistency) : null,
        min_trading_days: Number(minDays) || 0,
        warn_threshold_pct: Number(warn) || 80,
        danger_threshold_pct: Number(danger) || 90,
      });
      toast.success("Prop firm settings saved");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed";
      toast.error("Could not save", msg);
    }
  }

  const profileOptions = useMemo(
    () => (profiles.length ? profiles : [{ id: "custom", max_daily_loss_pct: 5, max_overall_drawdown_pct: 10, consistency_rule_pct: null, min_trading_days: 0 }]),
    [profiles]
  );

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Prop firm"
        subtitle="Daily loss and overall drawdown limits with distance-to-breach alerts on Today."
      />

      <div className="mb-5">
        <SettingsField label="Account">
          <SettingsSelect
            value={accountId || ""}
            onChange={(e) => setActiveAccountId(e.target.value)}
            disabled={accountsLoading}
          >
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SettingsSelect>
        </SettingsField>
      </div>

      <SettingsCard
        title="Challenge rules"
        description={isLoading ? "Loading…" : "Match your prop firm evaluation limits."}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <SettingsToggle
            checked={enabled}
            onChange={setEnabled}
            label="Enable monitoring"
            description="Show distance-to-breach on the Today dashboard"
          />

          <SettingsField label="Profile">
            <SettingsSelect value={profile} onChange={(e) => applyProfileDefaults(e.target.value)}>
              {profileOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </SettingsSelect>
          </SettingsField>

          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Max daily loss %">
              <SettingsInput
                type="number"
                step="0.1"
                min={0}
                value={maxDaily}
                onChange={(e) => setMaxDaily(e.target.value)}
              />
            </SettingsField>
            <SettingsField label="Max overall drawdown %">
              <SettingsInput
                type="number"
                step="0.1"
                min={0}
                value={maxOverall}
                onChange={(e) => setMaxOverall(e.target.value)}
              />
            </SettingsField>
            <SettingsField label="Consistency rule %" hint="Optional — leave blank if N/A">
              <SettingsInput
                type="number"
                step="0.1"
                min={0}
                value={consistency}
                onChange={(e) => setConsistency(e.target.value)}
                placeholder="—"
              />
            </SettingsField>
            <SettingsField label="Min trading days">
              <SettingsInput
                type="number"
                min={0}
                value={minDays}
                onChange={(e) => setMinDays(e.target.value)}
              />
            </SettingsField>
            <SettingsField label="Warn at % of limit used">
              <SettingsInput type="number" min={0} max={100} value={warn} onChange={(e) => setWarn(e.target.value)} />
            </SettingsField>
            <SettingsField label="Danger at % of limit used">
              <SettingsInput
                type="number"
                min={0}
                max={100}
                value={danger}
                onChange={(e) => setDanger(e.target.value)}
              />
            </SettingsField>
          </div>

          <Button type="submit" disabled={upsert.isPending || !accountId}>
            {upsert.isPending ? "Saving…" : "Save prop settings"}
          </Button>
        </form>
      </SettingsCard>
    </SettingsShell>
  );
}

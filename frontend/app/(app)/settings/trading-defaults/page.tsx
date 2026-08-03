"use client";

import { useEffect, useState } from "react";

import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";

const KEY = "tradefix_trading_defaults";

type Defaults = {
  default_symbol: string;
  default_quantity: string;
  default_fee: string;
  starting_balance: string;
  currency: string;
};

const INITIAL: Defaults = {
  default_symbol: "",
  default_quantity: "100",
  default_fee: "0",
  starting_balance: "10000",
  currency: "USD",
};

export default function TradingDefaultsPage() {
  const [values, setValues] = useState<Defaults>(INITIAL);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setValues({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    localStorage.setItem(KEY, JSON.stringify(values));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Trading Defaults"
        subtitle="Pre-fill common fields when adding trades."
      />
      <SettingsCard title="Defaults">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField label="Default Symbol">
            <SettingsInput
              value={values.default_symbol}
              onChange={(e) => setValues((v) => ({ ...v, default_symbol: e.target.value.toUpperCase() }))}
              placeholder="e.g. AAPL"
            />
          </SettingsField>
          <SettingsField label="Default Quantity">
            <SettingsInput
              type="number"
              value={values.default_quantity}
              onChange={(e) => setValues((v) => ({ ...v, default_quantity: e.target.value }))}
            />
          </SettingsField>
          <SettingsField label="Default Fee">
            <SettingsInput
              type="number"
              value={values.default_fee}
              onChange={(e) => setValues((v) => ({ ...v, default_fee: e.target.value }))}
            />
          </SettingsField>
          <SettingsField label="Starting Balance">
            <SettingsInput
              type="number"
              value={values.starting_balance}
              onChange={(e) => setValues((v) => ({ ...v, starting_balance: e.target.value }))}
            />
          </SettingsField>
          <SettingsField label="Currency">
            <SettingsInput
              value={values.currency}
              onChange={(e) => setValues((v) => ({ ...v, currency: e.target.value.toUpperCase() }))}
            />
          </SettingsField>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          {saved && <span className="self-center text-xs text-primary">Saved</span>}
          <Button type="button" onClick={save}>
            Save changes
          </Button>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}

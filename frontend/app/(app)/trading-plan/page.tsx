"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FeaturePage } from "@/components/ui/FeaturePage";
import { Textarea } from "@/components/ui/Input";

const KEY = "tradefix_trading_plan";

export default function TradingPlanPage() {
  const [plan, setPlan] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setPlan(localStorage.getItem(KEY) || "");
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    localStorage.setItem(KEY, plan);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <FeaturePage title="Trading Plan" subtitle="Write and keep your rules, risk limits, and process.">
      <Textarea
        rows={12}
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        placeholder={`Risk per trade:\nMax daily loss:\nSetups I take:\nRules I never break:`}
        className="border-white/10 bg-zinc-900"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save}>Save Plan</Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
      </div>
    </FeaturePage>
  );
}

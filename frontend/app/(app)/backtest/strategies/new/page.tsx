"use client";

import Link from "next/link";

import { StrategyForm } from "@/components/backtest/strategy/StrategyForm";

export default function NewStrategyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/backtest" className="text-sm text-muted hover:text-foreground">
        Back to backtesting
      </Link>
      <StrategyForm />
    </div>
  );
}

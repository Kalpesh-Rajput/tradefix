"use client";

import Link from "next/link";

import { SessionSetupForm } from "@/components/backtest/session/SessionSetupForm";

export default function NewSessionPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/backtest" className="text-sm text-muted hover:text-foreground">
        Back to backtesting
      </Link>
      <SessionSetupForm />
    </div>
  );
}

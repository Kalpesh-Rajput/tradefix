"use client";

import { Cable, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface AddAccountChoiceProps {
  onConnectBroker: () => void;
  onCreateDummy: () => void;
  onBack: () => void;
}

export function AddAccountChoice({
  onConnectBroker,
  onCreateDummy,
  onBack,
}: AddAccountChoiceProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-2 py-4 text-center sm:py-8">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        How do you want to add an account?
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Connect a live broker or trading platform, or create a dummy portfolio for manual and file
        imports.
      </p>

      <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onConnectBroker}
          className="group flex flex-col items-start rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cable className="h-5 w-5" />
          </span>
          <span className="mt-4 text-base font-semibold text-foreground">
            Connect broker / trading account
          </span>
          <span className="mt-1.5 text-sm text-muted">
            Choose a broker, prop firm, or platform and pick how to import trades.
          </span>
        </button>

        <button
          type="button"
          onClick={onCreateDummy}
          className="group flex flex-col items-start rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
            <FlaskConical className="h-5 w-5" />
          </span>
          <span className="mt-4 text-base font-semibold text-foreground">Dummy Account</span>
          <span className="mt-1.5 text-sm text-muted">
            Fill in account details and save to create a journal portfolio.
          </span>
        </button>
      </div>

      <Button type="button" variant="ghost" className="mt-8" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}

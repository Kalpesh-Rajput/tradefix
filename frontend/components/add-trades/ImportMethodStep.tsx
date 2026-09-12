"use client";

import clsx from "clsx";
import { FileUp, Layers, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { BrokerIcon } from "@/components/ui/BrokerIcon";
import { Button } from "@/components/ui/Button";
import type { UnifiedBroker } from "@/lib/brokers/unified-catalog";

export type ImportMethod = "auto-sync" | "file" | "manual";

interface ImportMethodStepProps {
  broker: UnifiedBroker | null;
  isDemo: boolean;
  onContinue: (method: ImportMethod) => void;
}

export function ImportMethodStep({ broker, isDemo, onContinue }: ImportMethodStepProps) {
  const autoSyncAvailable = !isDemo && Boolean(broker?.autoSyncAvailable);
  const [method, setMethod] = useState<ImportMethod | null>(
    autoSyncAvailable ? "auto-sync" : "file"
  );

  useEffect(() => {
    setMethod(autoSyncAvailable ? "auto-sync" : "file");
  }, [autoSyncAvailable, broker?.id, isDemo]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-1">
      <div className="shrink-0 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Select Import Method
        </h2>
        <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3 py-1.5">
          {isDemo ? (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm text-muted">
                You&apos;re setting up a <span className="font-medium text-foreground">Dummy account</span>
              </span>
            </>
          ) : broker ? (
            <>
              <BrokerIcon name={broker.name} size={28} />
              <span className="text-sm text-muted">
                You&apos;re linking <span className="font-medium text-foreground">{broker.name}</span>
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div
        className={clsx(
          "mt-8 grid flex-1 gap-4",
          isDemo ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
        )}
      >
        {!isDemo ? (
          <MethodCard
            selected={method === "auto-sync"}
            disabled={!autoSyncAvailable}
            badge={autoSyncAvailable ? "Recommended" : "Not available"}
            badgeTone={autoSyncAvailable ? "recommended" : "muted"}
            icon={<RefreshCw className="h-6 w-6" />}
            title="Auto-sync"
            description={
              autoSyncAvailable
                ? "Connect your broker and automatically sync your trades."
                : "Not available yet"
            }
            onSelect={() => autoSyncAvailable && setMethod("auto-sync")}
          />
        ) : null}

        <MethodCard
          selected={method === "file"}
          badge={!autoSyncAvailable || isDemo ? "Recommended" : undefined}
          badgeTone="recommended"
          icon={<FileUp className="h-6 w-6" />}
          title="File upload"
          description="Upload a broker-provided file with your trading history."
          onSelect={() => setMethod("file")}
        />

        <MethodCard
          selected={method === "manual"}
          icon={<Layers className="h-6 w-6" />}
          title="Add trade manually"
          description="Add your trades one by one with our interface."
          onSelect={() => setMethod("manual")}
        />
      </div>

      <div className="mt-8 shrink-0">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!method}
          onClick={() => method && onContinue(method)}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function MethodCard({
  selected,
  disabled,
  badge,
  badgeTone,
  icon,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  badgeTone?: "recommended" | "muted";
  icon: React.ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        "relative flex h-full flex-col rounded-xl border p-5 text-left transition",
        disabled
          ? "cursor-not-allowed border-border/60 bg-surface-2/50 opacity-60"
          : selected
            ? "border-primary bg-primary/[0.06] ring-1 ring-primary/30"
            : "border-border bg-card hover:border-primary/30 hover:bg-foreground/[0.02]"
      )}
    >
      {badge ? (
        <span
          className={clsx(
            "absolute left-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            badgeTone === "recommended"
              ? "bg-primary/15 text-primary"
              : "bg-foreground/5 text-muted"
          )}
        >
          {badge}
        </span>
      ) : null}
      <span
        className={clsx(
          "mt-6 flex h-12 w-12 items-center justify-center rounded-full",
          disabled ? "bg-foreground/5 text-muted" : "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </span>
      <span className="mt-4 text-base font-semibold text-foreground">{title}</span>
      <span className="mt-1.5 text-sm leading-relaxed text-muted">{description}</span>
    </button>
  );
}

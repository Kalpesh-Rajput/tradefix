"use client";

import clsx from "clsx";
import { FileUp, Layers, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { FileColumnSheet } from "@/components/add-trades/FileColumnSheet";
import { BrokerIcon } from "@/components/ui/BrokerIcon";
import { Button } from "@/components/ui/Button";

export type ImportMethod = "auto-sync" | "file" | "manual";

interface MethodBroker {
  id: string;
  name: string;
  autoSyncAvailable?: boolean;
}

interface ImportMethodStepProps {
  broker: MethodBroker | null;
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
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-1">
      <div className="shrink-0 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Select Import Method</h2>
        <div className="mt-3 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3 py-1.5">
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
          "mt-4 grid flex-1 items-stretch gap-4",
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
          >
            {autoSyncAvailable ? (
              <DetailPanel
                label="How it works"
                items={[
                  { title: "Connect", detail: "Use read-only broker access" },
                  { title: "Sync", detail: "Trades land in this account" },
                  { title: "Review", detail: "Check them in the journal" },
                ]}
              />
            ) : (
              <p className="mt-4 flex flex-1 items-end text-xs leading-relaxed text-muted">
                Use a file or add each trade yourself.
              </p>
            )}
          </MethodCard>
        ) : null}

        <MethodCard
          selected={method === "file"}
          badge={!autoSyncAvailable || isDemo ? "Recommended" : undefined}
          badgeTone="recommended"
          icon={<FileUp className="h-6 w-6" />}
          title="File upload"
          description="Upload a broker file or your own spreadsheet."
          onSelect={() => setMethod("file")}
        >
          <FileColumnSheet />
        </MethodCard>

        <MethodCard
          selected={method === "manual"}
          icon={<Layers className="h-6 w-6" />}
          title="Add trade manually"
          description="Log one trade at a time in the journal form."
          onSelect={() => setMethod("manual")}
        >
          <DetailPanel
            label="You will enter"
            items={[
              { title: "Identity", detail: "Symbol and side" },
              { title: "Size", detail: "Quantity, entry, and exit" },
              { title: "Timing", detail: "Open and close time" },
              { title: "Review", detail: "Notes, mood, and mistakes" },
            ]}
          />
        </MethodCard>
      </div>

      <div className="mt-4 shrink-0">
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
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  badgeTone?: "recommended" | "muted";
  icon: React.ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        "relative flex h-full flex-col rounded-xl border p-4 text-left transition",
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
      <span className="mt-4 flex items-center gap-3">
        <span
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            disabled ? "bg-foreground/5 text-muted" : "bg-primary/10 text-primary"
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">{description}</span>
        </span>
      </span>
      {children}
    </button>
  );
}

function DetailPanel({ label, items }: { label: string; items: { title: string; detail: string }[] }) {
  return (
    <div className="mt-3 flex grow flex-col rounded-lg border border-border bg-card/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <ul className="mt-2 flex grow flex-col justify-evenly gap-1.5">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="flex items-center gap-2.5 rounded-md bg-foreground/[0.03] px-2.5 py-1"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-[10px] font-semibold text-muted">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{item.title}</span>
              <span className="block text-[11px] leading-snug text-muted">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

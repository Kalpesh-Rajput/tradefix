"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Cable,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { BrokerPicker, brokerCategoryLabel } from "@/components/broker/BrokerPicker";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useConnectors } from "@/components/providers/ConnectorsProvider";
import { BrokerIcon } from "@/components/ui/BrokerIcon";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { CONNECTORS_URL, ConnectorsApiError } from "@/lib/connectors/api";
import type { BrokerCatalogItem, BrokerConnectPayload } from "@/lib/connectors/types";
import { useBrokerCatalog, useBrokerConnect, useBrokerDisconnect, useBrokerSync } from "@/lib/hooks/useBroker";

type WizardStep = "pick" | "credentials" | "connected";
type FieldKey =
  | "login"
  | "password"
  | "server"
  | "api_key"
  | "api_secret"
  | "passphrase"
  | "market_type"
  | "symbols";

const FIELD_META: Record<FieldKey, { label: string; hint?: string; placeholder?: string }> = {
  login: { label: "Account login", placeholder: "12345678" },
  password: {
    label: "Investor password",
    hint: "Use the read-only investor password, not your trading password.",
    placeholder: "••••••••",
  },
  server: { label: "Server", hint: "Must match exactly what you see in MetaTrader 5.", placeholder: "Exness-MT5Real" },
  api_key: { label: "API key", placeholder: "Your read-only API key" },
  api_secret: { label: "API secret", placeholder: "Your API secret" },
  passphrase: { label: "Passphrase", placeholder: "API passphrase" },
  market_type: { label: "Market type" },
  symbols: {
    label: "Symbols",
    hint: "Comma-separated. Example: BTCUSDT, ETHUSDT",
    placeholder: "BTCUSDT, ETHUSDT",
  },
};

function brokerErrorMessage(err: unknown): string {
  if (err instanceof ConnectorsApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function buildPayload(brokerId: string, values: Record<string, string>): BrokerConnectPayload {
  const payload: BrokerConnectPayload = { broker: brokerId };
  if (values.login) payload.login = Number(values.login);
  if (values.password) payload.password = values.password;
  if (values.server) payload.server = values.server.trim();
  if (values.api_key) payload.api_key = values.api_key.trim();
  if (values.api_secret) payload.api_secret = values.api_secret;
  if (values.passphrase) payload.passphrase = values.passphrase;
  if (values.market_type === "spot" || values.market_type === "futures") {
    payload.market_type = values.market_type;
  }
  if (values.symbols?.trim()) {
    payload.symbols = values.symbols
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return payload;
}

function StepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-primary">
        Step {step} of {total}
      </p>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

interface BrokerConnectWizardProps {
  compact?: boolean;
  className?: string;
}

export function BrokerConnectWizard({ compact = false, className }: BrokerConnectWizardProps) {
  const toast = useToast();
  const { logout } = useAuth();
  const { activeAccount } = useAccountPrefs();
  const {
    configured,
    authenticated,
    authLoading,
    health,
    healthLoading,
    connection,
  } = useConnectors();

  const catalogQuery = useBrokerCatalog();
  const connectMutation = useBrokerConnect();
  const syncMutation = useBrokerSync();
  const disconnectMutation = useBrokerDisconnect();

  const [step, setStep] = useState<WizardStep>(() => (connection ? "connected" : "pick"));
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [importToJournal, setImportToJournal] = useState(true);

  const brokers = useMemo(
    () => (catalogQuery.data?.brokers ?? []).filter((b) => b.implemented),
    [catalogQuery.data?.brokers]
  );

  const selectedBroker = useMemo(
    () => brokers.find((b) => b.id === selectedBrokerId),
    [brokers, selectedBrokerId]
  );

  const totalSteps = 2;

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (connection && step !== "credentials") {
      setStep("connected");
    }
  }, [connection, step]);

  async function onSwitchBroker() {
    if (connection) {
      try {
        await disconnectMutation.mutateAsync();
      } catch {
        // still allow picking a new broker
      }
    }
    setStep("pick");
    setSelectedBrokerId("");
  }

  function onPickBroker(broker: BrokerCatalogItem) {
    if (!authenticated) {
      toast.error("Sign out and sign in again", "Broker access is linked when you log in.");
      return;
    }
    setSelectedBrokerId(broker.id);
    setFields({});
    setStep("credentials");
  }

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    if (!selectedBroker) return;
    try {
      const res = await connectMutation.mutateAsync({
        payload: buildPayload(selectedBroker.id, fields),
        brokerName: selectedBroker.name,
      });
      toast.success(
        "Broker connected",
        `${selectedBroker.name} · ${res.account.currency} ${res.account.balance.toFixed(2)}`
      );
      setFields({});
      setStep("connected");
    } catch (err) {
      toast.error("Connection failed", brokerErrorMessage(err));
    }
  }

  async function onSync() {
    if (!connection) return;
    try {
      const result = await syncMutation.mutateAsync({
        importToJournal,
        accountId: activeAccount?.id,
      });
      const { sync, importResult } = result;
      const parts = [`${sync.total_trades} trades synced`];
      if (importResult) {
        parts.push(`${importResult.imported} new in journal`);
      }
      toast.success("Sync complete", parts.join(" · "));
    } catch (err) {
      toast.error("Sync failed", brokerErrorMessage(err));
    }
  }

  async function onDisconnect() {
    if (!connection) return;
    const ok = window.confirm(`Disconnect ${connection.broker_name}?`);
    if (!ok) return;
    try {
      await disconnectMutation.mutateAsync();
      setStep("pick");
      setSelectedBrokerId("");
      toast.success("Broker disconnected");
    } catch (err) {
      toast.error("Disconnect failed", brokerErrorMessage(err));
    }
  }

  if (!configured) {
    return (
      <div className={clsx("rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm", className)}>
        <p className="font-medium text-amber-100">Broker API not configured</p>
        <p className="mt-1 text-amber-100/75">
          Add <span className="font-mono">NEXT_PUBLIC_CONNECTORS_URL</span> to{" "}
          <span className="font-mono">.env.local</span> with your ngrok URL.
        </p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className={clsx("flex items-center justify-center gap-2 py-12 text-sm text-muted", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing broker connection…
      </div>
    );
  }

  if (step === "connected" && connection) {
    return (
      <div className={clsx("space-y-5", className)}>
        {!compact && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Cable className="h-3.5 w-3.5 text-primary" />
            {healthLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : health?.status === "ok" ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-3 w-3" />
                {health.broker_mode === "mt5" ? "Live MT5" : `Mode: ${health.broker_mode}`}
              </span>
            ) : (
              <span className="text-negative">API offline — check ngrok &amp; MT5</span>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <BrokerIcon name={connection.broker_name} size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{connection.broker_name}</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Account {connection.account_number} · {connection.server}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {connection.currency} {connection.balance.toFixed(2)}
                <span className="ml-2 text-sm font-normal text-muted">
                  equity {connection.equity.toFixed(2)}
                </span>
              </p>
              {connection.last_synced_at && (
                <p className="mt-1 text-xs text-muted">
                  Last synced {new Date(connection.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-primary/15 bg-black/10 px-5 py-4">
            {!compact && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={importToJournal}
                  onChange={(e) => setImportToJournal(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                Import into {activeAccount?.name ?? "journal"}
              </label>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void onDisconnect()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </Button>
              <Button type="button" size="sm" onClick={() => void onSync()} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync trades
              </Button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onSwitchBroker()}
          className="text-sm text-primary hover:underline"
        >
          Connect a different broker
        </button>
      </div>
    );
  }

  if (step === "credentials" && selectedBroker) {
    return (
      <div className={clsx("space-y-5", compact && "mx-auto max-w-lg", className)}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("pick")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <BrokerIcon name={selectedBroker.name} size={32} />
            <div>
              <p className="font-semibold text-foreground">{selectedBroker.name}</p>
              <p className="text-xs text-muted">
                {brokerCategoryLabel(selectedBroker.id)} · read-only
              </p>
            </div>
          </div>
        </div>

        <StepHeader
          step={2}
          total={totalSteps}
          title={`Connect ${selectedBroker.name}`}
          subtitle={selectedBroker.notes}
        />

        <form onSubmit={onConnect} className="space-y-4 rounded-xl border border-border bg-surface/40 p-5">
          {selectedBroker.fields.map((field) => {
            const key = field as FieldKey;
            const meta = FIELD_META[key] ?? { label: field };

            if (key === "market_type") {
              return (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                    {meta.label}
                  </label>
                  <select
                    value={fields.market_type ?? "spot"}
                    onChange={(e) => updateField("market_type", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="spot">Spot</option>
                    <option value="futures">Futures</option>
                  </select>
                </div>
              );
            }

            if (key === "password" || key === "api_secret" || key === "passphrase") {
              return (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                    {meta.label}
                  </label>
                  <PasswordInput
                    value={fields[key] ?? ""}
                    onChange={(e) => updateField(key, e.target.value)}
                    required
                    autoComplete="off"
                    placeholder={meta.placeholder}
                  />
                  {meta.hint && <p className="mt-1 text-xs text-muted">{meta.hint}</p>}
                </div>
              );
            }

            if (key === "server" && selectedBroker.server_hints.length > 0) {
              return (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                    {meta.label}
                  </label>
                  <select
                    value={fields.server ?? ""}
                    onChange={(e) => updateField("server", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                    required
                  >
                    <option value="">Select server…</option>
                    {selectedBroker.server_hints.map((hint) => (
                      <option key={hint} value={hint}>
                        {hint}
                      </option>
                    ))}
                  </select>
                  {meta.hint && <p className="mt-1 text-xs text-muted">{meta.hint}</p>}
                </div>
              );
            }

            return (
              <div key={key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                  {meta.label}
                </label>
                <Input
                  value={fields[key] ?? ""}
                  onChange={(e) => updateField(key, e.target.value)}
                  required
                  autoComplete="off"
                  type={key === "login" ? "number" : "text"}
                  placeholder={meta.placeholder}
                />
                {meta.hint && <p className="mt-1 text-xs text-muted">{meta.hint}</p>}
              </div>
            );
          })}

          <Button type="submit" disabled={connectMutation.isPending} className="w-full">
            {connectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Cable className="h-4 w-4" />
                Connect {selectedBroker.name}
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className={clsx("space-y-5", className)}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Cable className="h-3.5 w-3.5 text-primary" />
          <span className="truncate font-mono">{CONNECTORS_URL}</span>
          {healthLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : health?.status === "ok" ? (
            <span className="text-primary">· {health.broker_mode === "mt5" ? "Live MT5" : health.broker_mode}</span>
          ) : (
            <span className="text-negative">· offline</span>
          )}
        </div>
      )}

      <StepHeader
        step={1}
        total={totalSteps}
        title="Choose your broker"
        subtitle="Select your platform, then enter read-only credentials to sync trades."
      />

      {!compact && !authenticated && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="text-amber-100/90">Broker access links when you sign in. Sign out and back in once if this is your first time.</p>
          <Button type="button" variant="secondary" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      )}

      {catalogQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading brokers…
        </div>
      ) : catalogQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not reach the broker API. Make sure ngrok and TradeFix-Connectors are running on your PC.
        </div>
      ) : (
        <BrokerPicker
          brokers={brokers}
          disabled={!authenticated}
          compact={compact}
          onSelect={onPickBroker}
        />
      )}
    </div>
  );
}

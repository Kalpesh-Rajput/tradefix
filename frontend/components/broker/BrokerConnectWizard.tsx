"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Cable,
  CheckCircle2,
  Copy,
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
import { Input, PasswordInput, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { MT5_SERVERS } from "@/lib/brokers/mt5-servers";
import { CONNECTORS_URL, ConnectorsApiError, tradingViewWebhookUrl } from "@/lib/connectors/api";
import {
  allowsCustomServer,
  buildConnectPayload,
  connectFieldMeta,
  connectFormFields,
  CUSTOM_SERVER_VALUE,
  defaultConnectFields,
  isConnectFieldRequired,
  isEnvironmentServer,
  isMtFamily,
  isSecretField,
} from "@/lib/connectors/connect-fields";
import type { BrokerCatalogItem, ConnectResponse } from "@/lib/connectors/types";
import {
  useBrokerAccount,
  useBrokerCatalog,
  useBrokerConnect,
  useBrokerDisconnect,
  useBrokerSync,
} from "@/lib/hooks/useBroker";

type WizardStep = "pick" | "credentials" | "connected";

function serverDropdownOptions(broker: BrokerCatalogItem, selected?: string | null): string[] {
  const base = isMtFamily(broker) ? [...MT5_SERVERS] : [...(broker.server_hints ?? [])];
  const extra = selected?.trim();
  if (extra && extra !== CUSTOM_SERVER_VALUE && !base.some((item) => item.toLowerCase() === extra.toLowerCase())) {
    base.unshift(extra);
  }
  return base;
}

function credentialsHelp(broker: BrokerCatalogItem): string {
  if (isMtFamily(broker)) {
    return "Enter your login ID, investor password, and the exact MT5 server name.";
  }
  if (broker.id === "matchtrader") {
    return "Enter your MatchTrader email, password, and broker ID.";
  }
  if (broker.id === "ctrader") {
    return "Enter your cTrader client ID and access token.";
  }
  if (broker.id === "tradingview") {
    return "Enter a username label and webhook secret. Connect succeeds even before any alerts arrive.";
  }
  if (broker.id === "tradovate" || broker.id === "ninjatrader") {
    return "Enter your username and API password. Environment (live/demo) is optional.";
  }
  if (broker.fields.includes("api_key")) {
    return "Enter the read-only API credentials for this broker.";
  }
  return broker.notes;
}

function antiAutofillProps(brokerId: string, field: string, secret?: boolean) {
  return {
    id: `tf-connect-${brokerId}-${field}`,
    name: `tf-connect-${brokerId}-${field}`,
    autoComplete: secret ? ("new-password" as const) : ("off" as const),
    autoCorrect: "off" as const,
    autoCapitalize: "none" as const,
    spellCheck: false,
    "data-lpignore": "true",
    "data-1p-ignore": "true",
    "data-bwignore": "true",
  };
}

function brokerErrorMessage(err: unknown): string {
  if (err instanceof ConnectorsApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
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
  /** When set and no active connection, skip broker pick and open credentials. */
  initialBrokerId?: string | null;
  /** Shown as context only — never written into the form. */
  initialServer?: string | null;
  /** Company picked in Add Trades (shown above login). */
  companyLabel?: string | null;
  /** Render inside Add Trades: skip stored connection and the inner back button. */
  embedded?: boolean;
  /** Journal account to bind this connection_id to. */
  journalAccountId?: string | null;
  /** After connect + journal account, pull trades into the journal. */
  autoSyncOnConnect?: boolean;
  /** Called after a successful Connectors login so the journal account can be created. */
  onConnected?: (res: ConnectResponse) => void | string | Promise<void | string>;
}

export function BrokerConnectWizard({
  compact = false,
  className,
  initialBrokerId = null,
  initialServer = null,
  companyLabel = null,
  embedded = false,
  journalAccountId = null,
  autoSyncOnConnect = false,
  onConnected,
}: BrokerConnectWizardProps) {
  const toast = useToast();
  const { logout } = useAuth();
  const { activeAccount } = useAccountPrefs();
  const {
    configured,
    authenticated,
    authLoading,
    health,
    healthLoading,
    connectionFor,
    linkConnectionToAccount,
  } = useConnectors();

  const catalogQuery = useBrokerCatalog();
  const connectMutation = useBrokerConnect();
  const syncMutation = useBrokerSync();
  const disconnectMutation = useBrokerDisconnect();

  const presetServer = (initialServer ?? companyLabel)?.trim() || "";
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(journalAccountId);
  const [step, setStep] = useState<WizardStep>(() => (embedded && initialBrokerId ? "credentials" : "pick"));
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(() => {
    if (!presetServer) return {};
    return { server: presetServer };
  });
  const [importToJournal, setImportToJournal] = useState(true);
  const [preselectApplied, setPreselectApplied] = useState(false);
  const [sessionConnected, setSessionConnected] = useState(false);

  useEffect(() => {
    if (journalAccountId) setLinkedAccountId(journalAccountId);
  }, [journalAccountId]);

  const boundAccountId = embedded
    ? linkedAccountId
    : linkedAccountId ?? journalAccountId ?? activeAccount?.id ?? null;

  const connection = connectionFor(boundAccountId) ?? connectionFor(null);

  const liveAccountQuery = useBrokerAccount(connection ? connection.journal_account_id ?? null : boundAccountId);
  const liveAccount = liveAccountQuery.data;

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
    if (embedded && !sessionConnected) return;
    if (connection && step !== "credentials") {
      setStep("connected");
    }
  }, [connection, embedded, sessionConnected, step]);

  useEffect(() => {
    if (preselectApplied || !initialBrokerId || brokers.length === 0) return;
    if (!embedded && connection) return;
    const match =
      brokers.find((b) => b.id === initialBrokerId) ??
      brokers.find((b) => b.id === "mt5" && /^(mt5|metatrader-?5)$/i.test(initialBrokerId));
    if (!match) return;
    setSelectedBrokerId(match.id);
    setFields(defaultConnectFields(match, presetServer));
    setStep("credentials");
    setPreselectApplied(true);
  }, [brokers, connection, embedded, initialBrokerId, presetServer, preselectApplied]);

  async function onSwitchBroker() {
    if (connection) {
      try {
        await disconnectMutation.mutateAsync(boundAccountId);
      } catch {
        // still allow picking a new broker
      }
    }
    setSessionConnected(false);
    setLinkedAccountId(embedded ? null : linkedAccountId);
    setStep("pick");
    setSelectedBrokerId("");
  }

  function onPickBroker(broker: BrokerCatalogItem) {
    if (!authenticated) {
      toast.error("Sign out and sign in again", "Broker access is linked when you log in.");
      return;
    }
    setSelectedBrokerId(broker.id);
    setFields(
      broker.id === initialBrokerId
        ? defaultConnectFields(broker, presetServer)
        : defaultConnectFields(broker)
    );
    setStep("credentials");
  }

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    if (!selectedBroker) return;
    try {
      const payload = buildConnectPayload(selectedBroker.id, fields);
      const { res } = await connectMutation.mutateAsync({
        payload,
        brokerName: selectedBroker.name,
        journalAccountId: boundAccountId,
      });
      setSessionConnected(true);
      let accountId = boundAccountId;
      try {
        if (onConnected) {
          const returned = await onConnected(res);
          if (typeof returned === "string" && returned) accountId = returned;
        }
      } catch (err) {
        toast.error("Broker connected, but the journal account could not be saved", brokerErrorMessage(err));
      }
      if (accountId) {
        linkConnectionToAccount(accountId);
        setLinkedAccountId(accountId);
      }
      toast.success(
        "Broker connected",
        res.warning || `${selectedBroker.name} · ${res.account.currency} ${res.account.balance.toFixed(2)}`
      );
      if (autoSyncOnConnect && accountId) {
        try {
          const result = await syncMutation.mutateAsync({ importToJournal: true, accountId });
          const parts = [`${result.sync.total_trades} trades synced`];
          if (result.importResult) parts.push(`${result.importResult.imported} new in journal`);
          toast.success("Sync complete", parts.join(" · "));
        } catch (err) {
          toast.error("Connected, but sync failed", brokerErrorMessage(err));
        }
      }
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
        accountId: boundAccountId ?? activeAccount?.id,
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
      await disconnectMutation.mutateAsync(boundAccountId);
      setSessionConnected(false);
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

  const displayBalance = liveAccount?.balance ?? connection?.balance;
  const displayEquity = liveAccount?.equity ?? connection?.equity;
  const displayCurrency = liveAccount?.currency ?? connection?.currency;
  const displayServer = liveAccount?.server ?? connection?.server;
  const displayAccountNumber = liveAccount?.account_number ?? connection?.account_number;

  if (step === "connected" && connection) {
    const webhookUrl =
      connection.broker_id === "tradingview" ? tradingViewWebhookUrl(connection.connection_id) : null;

    return (
      <div className={clsx("space-y-5", className)}>
        {!compact && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Cable className="h-3.5 w-3.5 text-primary" />
            <a
              href={CONNECTORS_URL}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono text-primary hover:underline"
              title="Open live ngrok URL"
            >
              {CONNECTORS_URL}
            </a>
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
                {connection.kind ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted">{connection.kind}</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                Account {displayAccountNumber} · {displayServer}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {displayCurrency} {Number(displayBalance ?? 0).toFixed(2)}
                <span className="ml-2 text-sm font-normal text-muted">
                  equity {Number(displayEquity ?? 0).toFixed(2)}
                </span>
              </p>
              {connection.last_synced_at && (
                <p className="mt-1 text-xs text-muted">
                  Last synced {new Date(connection.last_synced_at).toLocaleString()}
                </p>
              )}
              {connection.market_type ? (
                <p className="mt-1 text-xs text-muted">Market: {connection.market_type}</p>
              ) : null}
            </div>
          </div>

          {connection.warning ? (
            <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm text-amber-100/90">
              {connection.warning}
            </div>
          ) : null}

          {webhookUrl ? (
            <div className="space-y-2 border-t border-primary/15 px-5 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">TradingView webhook</p>
              <p className="text-muted">
                POST alerts to this URL with <span className="font-mono">?secret=</span> or header{" "}
                <span className="font-mono">X-Webhook-Secret</span> using the webhook secret you entered.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-black/20 px-2 py-1.5 text-xs text-foreground">
                  {webhookUrl}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(webhookUrl);
                    toast.success("Webhook URL copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          ) : null}

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
    const formFields = connectFormFields(selectedBroker);

    return (
      <div className={clsx("space-y-5", compact && "mx-auto max-w-lg", className)}>
        {embedded ? (
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Connect {selectedBroker.name}
            </h2>
            <p className="mt-2 text-sm text-muted">{credentialsHelp(selectedBroker)}</p>
            {companyLabel ? <p className="mt-1 text-xs text-muted">{companyLabel}</p> : null}
          </div>
        ) : (
          <>
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
              subtitle={credentialsHelp(selectedBroker)}
            />
          </>
        )}

        {embedded && !authenticated ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            Broker access links when you sign in. Sign out and back in once if this is your first time.
          </div>
        ) : null}

        <form
          onSubmit={onConnect}
          autoComplete="off"
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          {formFields.map((field) => {
            const meta = connectFieldMeta(selectedBroker, field);
            const required = isConnectFieldRequired(selectedBroker, field);
            const lockProps = antiAutofillProps(selectedBroker.id, field, isSecretField(selectedBroker, field));

            if (field === "market_type") {
              return (
                <div key={field}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                    {meta.label}
                    {!required ? <span className="ml-1 normal-case text-muted">optional</span> : null}
                  </label>
                  <select
                    value={fields.market_type ?? "spot"}
                    onChange={(e) => updateField("market_type", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary"
                    required={required}
                  >
                    <option value="spot">Spot</option>
                    <option value="futures">Futures</option>
                  </select>
                </div>
              );
            }

            if (isSecretField(selectedBroker, field)) {
              return (
                <div key={field}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                    {meta.label}
                  </label>
                  <PasswordInput
                    {...lockProps}
                    value={fields[field] ?? ""}
                    onChange={(e) => updateField(field, e.target.value)}
                    required={required}
                    placeholder={meta.placeholder}
                  />
                  {meta.hint && <p className="mt-1 text-xs text-muted">{meta.hint}</p>}
                </div>
              );
            }

            if (field === "server") {
              const options = serverDropdownOptions(selectedBroker, fields.server || presetServer);
              const customAllowed = allowsCustomServer(selectedBroker);
              const envOnly = isEnvironmentServer(selectedBroker.id);
              const current = fields.server ?? "";
              const inList = options.some((item) => item.toLowerCase() === current.toLowerCase());
              const selectValue = !current ? "" : inList ? current : customAllowed ? CUSTOM_SERVER_VALUE : current;

              if (envOnly || options.length > 0) {
                return (
                  <div key={field} className="space-y-2">
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                      {meta.label}
                      {!required ? <span className="ml-1 normal-case text-muted">optional</span> : null}
                    </label>
                    <Select
                      value={
                        fields.server_pick === CUSTOM_SERVER_VALUE || (!inList && current && customAllowed)
                          ? CUSTOM_SERVER_VALUE
                          : selectValue
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === CUSTOM_SERVER_VALUE) {
                          setFields((prev) => ({
                            ...prev,
                            server: inList ? "" : prev.server,
                            server_pick: CUSTOM_SERVER_VALUE,
                          }));
                          return;
                        }
                        setFields((prev) => ({
                          ...prev,
                          server: value,
                          server_pick: value,
                        }));
                      }}
                      required={required && !customAllowed}
                    >
                      <option value="">{envOnly ? "Default (live)" : "Select server…"}</option>
                      {(envOnly ? ["live", "demo"] : options).map((server) => (
                        <option key={server} value={server}>
                          {server}
                        </option>
                      ))}
                      {customAllowed ? (
                        <option value={CUSTOM_SERVER_VALUE}>Enter exact server name…</option>
                      ) : null}
                    </Select>
                    {customAllowed && selectValue === CUSTOM_SERVER_VALUE ? (
                      <Input
                        {...antiAutofillProps(selectedBroker.id, "server_custom")}
                        value={inList ? "" : current}
                        onChange={(e) => updateField("server", e.target.value)}
                        required={required}
                        placeholder="Exact MT5 server name"
                      />
                    ) : null}
                    {meta.hint && <p className="mt-1 text-xs text-muted">{meta.hint}</p>}
                  </div>
                );
              }
            }

            return (
              <div key={field}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                  {meta.label}
                  {!required ? <span className="ml-1 normal-case text-muted">optional</span> : null}
                </label>
                <Input
                  {...lockProps}
                  value={fields[field] ?? ""}
                  onChange={(e) => updateField(field, e.target.value)}
                  required={required}
                  inputMode={meta.inputMode === "numeric" ? "numeric" : undefined}
                  type="text"
                  placeholder={meta.placeholder}
                />
                {meta.hint && <p className="mt-1 text-xs text-muted">{meta.hint}</p>}
              </div>
            );
          })}

          <Button type="submit" disabled={connectMutation.isPending || !authenticated} className="w-full">
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
          <a
            href={CONNECTORS_URL}
            target="_blank"
            rel="noreferrer"
            className="truncate font-mono text-primary hover:underline"
            title="Open live ngrok URL"
          >
            {CONNECTORS_URL}
          </a>
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

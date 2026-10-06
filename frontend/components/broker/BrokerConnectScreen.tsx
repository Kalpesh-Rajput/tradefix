"use client";

import clsx from "clsx";
import { Check, Link2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BrokerFileImportPanel } from "@/components/broker/BrokerFileImportPanel";
import { BrokerMark } from "@/components/broker/BrokerMark";
import { SyncRangeField } from "@/components/broker/SyncRangeField";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/Input";
import { api } from "@/lib/api";
import {
  instructionTitle,
  methodLabel,
  type BrokerProvider,
  type ProviderField,
} from "@/lib/brokers/provider";
import {
  apiMessage,
  useBrokerConnections,
  useConnectProvider,
  useConnectionStatus,
  useDisconnectConnection,
  usePatchConnection,
  useSyncConnection,
  useValidateConnection,
  type BrokerConnectionSnapshot,
} from "@/lib/hooks/useProviders";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

const SKIP_ON_FORM = new Set(["history_preset", "timezone"]);

interface BrokerConnectScreenProps {
  provider: BrokerProvider;
  initialServer?: string | null;
  onManual?: () => void;
  onChangeProvider?: () => void;
}

export function BrokerConnectScreen({
  provider,
  initialServer,
  onManual,
  onChangeProvider,
}: BrokerConnectScreenProps) {
  const { openModal } = useAddTradeModal();
  const connectionsQuery = useBrokerConnections();
  const connect = useConnectProvider();
  const sync = useSyncConnection();
  const patch = usePatchConnection();
  const disconnect = useDisconnectConnection();
  const validate = useValidateConnection();

  const [tab, setTab] = useState(firstTab(provider));
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(provider, initialServer));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [created, setCreated] = useState<BrokerConnectionSnapshot | null>(null);
  const [hiddenId, setHiddenId] = useState<string | null>(null);

  useEffect(() => {
    setTab(firstTab(provider));
    setValues(initialValues(provider, initialServer));
    setError(null);
    setNotice(null);
    setOverrideId(null);
    setCreated(null);
    setHiddenId(null);
    // Reset only when the selected provider changes. The registry object is stable for that id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id, initialServer]);

  const saved = useMemo(
    () =>
      connectionsQuery.data?.connections.find(
        (connection) => connection.provider === provider.id && connection.status !== "disconnected"
      ) ?? null,
    [connectionsQuery.data?.connections, provider.id]
  );
  const connectionId = overrideId ?? (saved && saved.id !== hiddenId ? saved.id : null);
  const statusQuery = useConnectionStatus(connectionId, Boolean(connectionId));
  const connection =
    statusQuery.data?.connection ??
    (created && created.id === connectionId ? created : null) ??
    (saved && saved.id === connectionId ? saved : null);
  const run = statusQuery.data?.run ?? connection?.latest_run ?? null;
  const running = run?.status === "queued" || run?.status === "running" || connection?.status === "syncing";

  const methods = provider.methods.filter((method) => method === "broker_sync" || method === "file_import" || method === "manual");
  const credentialFields = provider.fields.filter((field) => !SKIP_ON_FORM.has(field.key));
  const presetField = provider.fields.find((field) => field.key === "history_preset");
  const timezoneField = provider.fields.find((field) => field.key === "timezone");
  const paired = credentialFields.some((field) => field.key === "login") && credentialFields.some((field) => field.key === "password");
  const oauth = provider.auth_type === "oauth";
  const ready =
    oauth ||
    credentialFields.every((field) => !field.required || Boolean(values[field.key]?.trim())) &&
      (values.history_preset !== "custom" || (Boolean(values.history_from) && Boolean(values.history_to)));

  function setField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onConnect() {
    setError(null);
    setNotice(null);
    try {
      const result = await connect.mutateAsync({
        provider: provider.id,
        credentials: values,
        history_preset: values.history_preset || "30d",
        history_from: values.history_preset === "custom" ? values.history_from : undefined,
        history_to: values.history_preset === "custom" ? values.history_to : undefined,
        environment: values.environment,
      });
      setCreated(result.connection);
      setOverrideId(result.connection.id);
      setHiddenId(null);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  async function onOAuth() {
    setError(null);
    if (provider.id !== "ctrader") {
      setError("Sign-in for this provider is not available yet.");
      return;
    }
    try {
      const data = await api.get<{ url: string }>(
        `/api/brokers/ctrader/authorize?environment=${encodeURIComponent(values.environment || "demo")}`
      );
      window.location.href = data.url;
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  async function onSync() {
    if (!connectionId) return;
    if (running) {
      setNotice("Sync already in progress");
      return;
    }
    setNotice(null);
    setError(null);
    try {
      await sync.mutateAsync(connectionId);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  async function onDisconnect() {
    if (!connectionId) return;
    if (!window.confirm("Disconnecting stops future synchronization. Existing journal trades stay.")) return;
    setError(null);
    try {
      await disconnect.mutateAsync(connectionId);
      setHiddenId(connectionId);
      setOverrideId(null);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  const steps = provider.instructions.steps ?? [];
  const extraInstructions = Object.entries(provider.instructions).filter(
    ([key, lines]) => key !== "steps" && lines.length > 0
  );
  const egress = connectionsQuery.data?.egress_ip;
  const showEgress = provider.limitations.some((line) => line.includes("BROKER_EGRESS_IP"));

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <BrokerMark provider={provider} size={44} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{provider.display_name}</h2>
            {onChangeProvider ? (
              <button type="button" className="text-xs font-medium text-primary" onClick={onChangeProvider}>
                Change broker
              </button>
            ) : null}
          </div>
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">How to Connect</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{provider.description}</p>
          {steps.length > 0 ? (
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-muted">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </section>

        <div className="mt-5 space-y-4">
          {credentialFields.map((field) =>
            field.help ? (
              <div key={field.key}>
                <p className="text-sm font-semibold text-foreground">{field.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{field.help}</p>
              </div>
            ) : null
          )}
        </div>

        {extraInstructions.length > 0 ? (
          <div className="mt-6 space-y-2 border-t border-border pt-4">
            {extraInstructions.map(([key, lines]) => (
              <details key={key} className="group">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">{instructionTitle(key)}</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : null}
      </aside>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex gap-4 overflow-x-auto border-b border-border" role="tablist" aria-label="Import method">
          {methods.map((method) => (
            <button
              key={method}
              type="button"
              role="tab"
              aria-selected={tab === method}
              onClick={() => setTab(method)}
              className={clsx(
                "shrink-0 border-b-2 px-1 pb-3 text-sm font-medium",
                tab === method ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {methodLabel(method)}
            </button>
          ))}
        </div>

        <div className="mt-5" role="tabpanel">
          {tab === "broker_sync" && provider.methods.includes("broker_sync") ? (
            connection ? (
              <ConnectedState
                provider={provider}
                connection={connection}
                events={statusQuery.data?.events ?? []}
                running={running}
                busy={sync.isPending || patch.isPending || disconnect.isPending || validate.isPending}
                notice={notice}
                error={error}
                onSync={() => void onSync()}
                onPause={() => void patch.mutateAsync({ connectionId: connection.id, body: { paused: true } }).catch((err) => setError(apiMessage(err)))}
                onResume={() => void patch.mutateAsync({ connectionId: connection.id, body: { paused: false } }).catch((err) => setError(apiMessage(err)))}
                onDisconnect={() => void onDisconnect()}
                onReconnect={() =>
                  void validate.mutateAsync(connection.id).catch((err) => setError(apiMessage(err)))
                }
              />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (oauth) void onOAuth();
                  else void onConnect();
                }}
              >
                {timezoneField ? (
                  <label className="block text-sm">
                    <span className="font-medium text-foreground">{timezoneField.label}</span>
                    <input
                      readOnly
                      value={timezoneLabel()}
                      aria-label={timezoneField.label}
                      className="mt-1 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-foreground"
                    />
                    {timezoneField.help ? <span className="mt-1 block text-xs text-muted">{timezoneField.help}</span> : null}
                  </label>
                ) : null}

                {paired ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {credentialFields
                      .filter((field) => field.key === "login" || field.key === "password")
                      .map((field) => (
                        <FieldControl key={field.key} field={field} value={values[field.key] || ""} onChange={setField} />
                      ))}
                  </div>
                ) : null}
                <div className="space-y-3">
                  {credentialFields
                    .filter((field) => !paired || (field.key !== "login" && field.key !== "password"))
                    .map((field) => (
                      <FieldControl key={field.key} field={field} value={values[field.key] || ""} onChange={setField} />
                    ))}
                </div>

                {presetField ? (
                  <SyncRangeField
                    preset={values.history_preset || "30d"}
                    from={values.history_from || ""}
                    to={values.history_to || ""}
                    options={presetField.options}
                    onChange={(next) =>
                      setValues((current) => ({
                        ...current,
                        history_preset: next.preset,
                        history_from: next.from,
                        history_to: next.to,
                      }))
                    }
                  />
                ) : null}

                {showEgress ? (
                  <p className="text-xs text-muted">
                    Egress IP for an allowlist: {egress || "not configured on this server."}
                  </p>
                ) : null}

                {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

                <Button type="submit" className="h-12 w-full rounded-xl" disabled={!ready || connect.isPending}>
                  {oauth ? (
                    `Continue with ${provider.display_name}`
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      {connect.isPending ? "Connecting…" : "Connect & Sync Trades"}
                    </>
                  )}
                </Button>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                  Imported data is used for journaling and analytics. Credentials are encrypted on the server. You can disconnect at any time.
                </p>
              </form>
            )
          ) : null}

          {tab === "file_import" ? <BrokerFileImportPanel provider={provider} /> : null}

          {tab === "manual" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Add a trade with the same journal form used everywhere else. Nothing is stored until you save it.
              </p>
              <Button
                type="button"
                onClick={() => {
                  if (onManual) onManual();
                  else openModal("manual");
                }}
              >
                Add trade manually
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ConnectedState({
  provider,
  connection,
  events,
  running,
  busy,
  notice,
  error,
  onSync,
  onPause,
  onResume,
  onDisconnect,
  onReconnect,
}: {
  provider: BrokerProvider;
  connection: BrokerConnectionSnapshot;
  events: { step: string; state: string; detail: string | null }[];
  running: boolean;
  busy: boolean;
  notice: string | null;
  error: string | null;
  onSync: () => void;
  onPause: () => void;
  onResume: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const account = connection.account;
  const run = connection.latest_run;
  const rows = [
    account?.masked_id ? ["Account", account.masked_id] : null,
    account?.account_type ? ["Type", account.account_type] : null,
    account?.currency ? ["Currency", account.currency] : null,
    account?.balance != null ? ["Balance", account.balance] : null,
    account?.equity != null ? ["Equity", account.equity] : null,
    connection.last_success_at ? ["Last sync", new Date(connection.last_success_at).toLocaleString()] : null,
    connection.realtime_status && connection.realtime_status !== "off"
      ? ["Realtime", connection.realtime_status]
      : null,
  ].filter((row): row is [string, string] => Boolean(row));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border p-4">
        <div className="flex items-center gap-3">
          <BrokerMark provider={provider} size={40} />
          <div>
            <p className="font-semibold text-foreground">{connection.display_name || provider.display_name}</p>
            <p className="text-xs capitalize text-muted">
              {connection.paused ? "Paused" : connection.status.replaceAll("_", " ")}
            </p>
          </div>
        </div>
        {rows.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="space-y-2 text-sm text-foreground">
        {running ? <p>Fetching trade history...</p> : null}
        {events.map((event) => (
          <p key={`${event.step}-${event.state}`}>
            {event.state === "done" ? <Check className="mr-1 inline h-3.5 w-3.5 text-positive" /> : null}
            {event.step}
            {event.detail ? ` — ${event.detail}` : ""}
          </p>
        ))}
        {run ? (
          <p className="text-muted">
            {run.records_received} records received
            {run.records_created ? `, ${run.records_created} created` : ""}
            {run.records_updated ? `, ${run.records_updated} updated` : ""}
            {run.records_skipped ? `, ${run.records_skipped} already synced` : ""}
            {run.records_failed ? `, ${run.records_failed} failed` : ""}
          </p>
        ) : null}
        {run?.status === "succeeded" || connection.status === "synced" ? <p>Sync complete</p> : null}
        {connection.last_error_message ? <p className="text-destructive">{connection.last_error_message}</p> : null}
        {run?.error_message ? <p className="text-destructive">{run.error_message}</p> : null}
      </div>

      {notice ? <p className="text-sm text-foreground">{notice}</p> : null}
      {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy || running} onClick={onSync}>
          {running ? "Sync already in progress" : "Sync Now"}
        </Button>
        {connection.paused ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={onResume}>
            Resume
          </Button>
        ) : (
          <Button type="button" variant="secondary" disabled={busy} onClick={onPause}>
            Pause
          </Button>
        )}
        {connection.status === "auth_expired" || connection.status === "error" || connection.status === "degraded" ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={onReconnect}>
            Reconnect
          </Button>
        ) : null}
        <Button type="button" variant="danger" disabled={busy} onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ProviderField;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-foreground">
        {field.required ? <span className="text-destructive">* </span> : null}
        {field.label}
      </span>
      {field.options.length > 0 ? (
        <select
          className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={value || field.options[0]}
          aria-label={field.label}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.secret ? (
        <PasswordInput
          className="mt-1 h-11 rounded-xl"
          value={value}
          placeholder={field.placeholder}
          aria-label={field.label}
          autoComplete="off"
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : (
        <input
          className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          value={value}
          placeholder={field.placeholder}
          aria-label={field.label}
          autoComplete="off"
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      )}
    </label>
  );
}

function firstTab(provider: BrokerProvider): string {
  if (provider.methods.includes("broker_sync")) return "broker_sync";
  if (provider.methods.includes("file_import")) return "file_import";
  return "manual";
}

function initialValues(provider: BrokerProvider, initialServer?: string | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of provider.fields) {
    if (field.options.length > 0 && field.key !== "history_preset") values[field.key] = field.options[0];
  }
  const preset = provider.fields.find((field) => field.key === "history_preset");
  if (preset) values.history_preset = preset.options.includes("30d") ? "30d" : preset.options[0] || "30d";
  if (initialServer) values.server = initialServer;
  return values;
}

function timezoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = new Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return offset ? `${offset} ${zone}` : zone;
}

"use client";

import { BrokerConnectPanel } from "@/components/broker/BrokerConnectPanel";
import { SettingsCard, SettingsPageHeader, SettingsShell } from "@/components/settings/SettingsShell";

export function BrokerSettingsPage() {
  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Broker connection"
        subtitle="Connect your live broker and sync read-only trades into your journal."
      />

      <SettingsCard title="Connect & sync">
        <BrokerConnectPanel />
      </SettingsCard>

      <p className="text-xs text-zinc-600">
        Your ngrok URL must stay running on your PC with MetaTrader open for live MT5 sync. If the tunnel restarts, update{" "}
        <span className="font-mono text-zinc-500">NEXT_PUBLIC_CONNECTORS_URL</span> in{" "}
        <span className="font-mono text-zinc-500">.env.local</span>.
      </p>
    </SettingsShell>
  );
}

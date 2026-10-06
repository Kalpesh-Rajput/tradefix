"use client";

import { BrokerIntegrationPanel } from "@/components/broker/BrokerIntegrationPanel";
import { SettingsPageHeader, SettingsShell } from "@/components/settings/SettingsShell";

export function BrokerSettingsPage() {
  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Broker connection"
        subtitle="Select a platform, then sync trades, import a file, or add one by hand."
      />
      <BrokerIntegrationPanel />
    </SettingsShell>
  );
}

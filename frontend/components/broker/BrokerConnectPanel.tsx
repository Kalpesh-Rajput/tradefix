"use client";

import { BrokerIntegrationPanel } from "@/components/broker/BrokerIntegrationPanel";

interface BrokerConnectPanelProps {
  compact?: boolean;
  className?: string;
  initialBrokerId?: string | null;
  initialServer?: string | null;
  journalAccountId?: string | null;
}

/** Broker connect entry — delegates to the multi-step wizard. */
export function BrokerConnectPanel({
  className,
  initialBrokerId = null,
  initialServer = null,
}: BrokerConnectPanelProps) {
  return (
    <div className={className}>
      <BrokerIntegrationPanel initialProviderId={initialBrokerId} initialServer={initialServer} />
    </div>
  );
}

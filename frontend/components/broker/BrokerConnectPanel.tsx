"use client";

import { BrokerConnectWizard } from "@/components/broker/BrokerConnectWizard";

interface BrokerConnectPanelProps {
  compact?: boolean;
  className?: string;
  initialBrokerId?: string | null;
  initialServer?: string | null;
  journalAccountId?: string | null;
}

/** Broker connect entry — delegates to the multi-step wizard. */
export function BrokerConnectPanel({
  compact = false,
  className,
  initialBrokerId = null,
  initialServer = null,
  journalAccountId = null,
}: BrokerConnectPanelProps) {
  return (
    <BrokerConnectWizard
      compact={compact}
      className={className}
      initialBrokerId={initialBrokerId}
      initialServer={initialServer}
      journalAccountId={journalAccountId}
    />
  );
}

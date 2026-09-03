"use client";

import { BrokerConnectWizard } from "@/components/broker/BrokerConnectWizard";

interface BrokerConnectPanelProps {
  compact?: boolean;
  className?: string;
}

/** Broker connect entry — delegates to the multi-step wizard. */
export function BrokerConnectPanel({ compact = false, className }: BrokerConnectPanelProps) {
  return <BrokerConnectWizard compact={compact} className={className} />;
}

"use client";

import { useEffect, useState } from "react";

import { BrokerConnectScreen } from "@/components/broker/BrokerConnectScreen";
import { BrokerPickerScreen } from "@/components/broker/BrokerPickerScreen";
import { findProvider, type BrokerProvider } from "@/lib/brokers/provider";
import { apiMessage, useProviderRegistry } from "@/lib/hooks/useProviders";

interface BrokerIntegrationPanelProps {
  initialProviderId?: string | null;
  initialServer?: string | null;
  onManual?: () => void;
}

export function BrokerIntegrationPanel({
  initialProviderId = null,
  initialServer = null,
  onManual,
}: BrokerIntegrationPanelProps) {
  const registry = useProviderRegistry();
  const providers = registry.data?.brokers ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(initialProviderId);
  const [opened, setOpened] = useState(Boolean(initialProviderId));
  const selected = providers.find((item) => item.id === selectedId) ?? null;
  const provider = opened ? findProvider(providers, selectedId) : null;

  useEffect(() => {
    if (!initialProviderId) return;
    setSelectedId(initialProviderId);
    setOpened(true);
  }, [initialProviderId]);

  if (opened && registry.isLoading) {
    return <p className="py-16 text-center text-sm text-muted">Loading brokers...</p>;
  }

  if (opened && provider) {
    return (
      <BrokerConnectScreen
        provider={provider}
        initialServer={initialServer}
        onManual={onManual}
        onChangeProvider={() => setOpened(false)}
      />
    );
  }

  return (
    <BrokerPickerScreen
      providers={providers}
      loading={registry.isLoading}
      error={
        registry.isError
          ? apiMessage(registry.error)
          : opened && initialProviderId && !registry.isLoading && !provider
            ? "That broker is not in the registry."
            : null
      }
      onRetry={() => void registry.refetch()}
      selectedId={selected?.id ?? null}
      onSelect={(item: BrokerProvider) => setSelectedId(item.id)}
      onContinue={() => {
        if (selected) setOpened(true);
      }}
    />
  );
}

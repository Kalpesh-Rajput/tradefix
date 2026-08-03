"use client";

import { ComingFeature, SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

export default function SubscriptionSettingsPage() {
  return (
    <SettingsPlaceholder
      title="Subscription"
      subtitle="Manage your plan and billing."
      cardTitle="Current plan"
    >
      <ComingFeature
        title="TradeFix Free"
        body="You're on the free plan with unlimited manual trades, CSV import, and AI agents via OpenRouter."
        cta="View plans"
      />
    </SettingsPlaceholder>
  );
}

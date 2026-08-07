"use client";

import {
  SettingsCard,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";

export default function SubscriptionSettingsPage() {
  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Billing"
        subtitle="Subscriptions are paused while we finish the core journal."
      />
      <SettingsCard
        title="Coming later"
        description="All TradeFix features are unlocked for now. Paid plans (Free vs Pro) will return once the product is ready to monetize."
      >
        <p className="text-sm text-zinc-400">
          No payment method is required. Use Analytics, Coach, Prop Firm rules, Wiki, and Mentor
          without upgrading.
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}

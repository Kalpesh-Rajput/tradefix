"use client";

import { FeaturePage } from "@/components/ui/FeaturePage";

export default function PerksPage() {
  return (
    <FeaturePage title="Perks" subtitle="Benefits available on your TradeFix account.">
      <ul className="space-y-3">
        <li className="flex justify-between border-b border-white/[0.06] pb-3">
          <span className="text-white">Unlimited manual trades</span>
          <span className="text-primary">Active</span>
        </li>
        <li className="flex justify-between border-b border-white/[0.06] pb-3">
          <span className="text-white">AI agents (OpenRouter)</span>
          <span className="text-primary">Active</span>
        </li>
        <li className="flex justify-between pb-1">
          <span className="text-white">CSV import</span>
          <span className="text-primary">Active</span>
        </li>
      </ul>
    </FeaturePage>
  );
}

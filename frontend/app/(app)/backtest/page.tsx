"use client";

import Link from "next/link";

import { BacktestHubTabs } from "@/components/backtest/BacktestHubTabs";
import { HubHero } from "@/components/backtest/hub/HubHero";
import { useAuth } from "@/components/providers/AuthProvider";

export default function BacktestPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <HubHero
        adminAction={
          user?.role === "admin" ? (
            <Link href="/admin/data-status" className="px-2 text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline">
              Market data
            </Link>
          ) : null
        }
      />
      <BacktestHubTabs />
    </div>
  );
}

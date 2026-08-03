"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/components/providers/AuthProvider";
import { AddTradeModal } from "@/components/trade/AddTradeModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/today";
  const isSettings = pathname?.startsWith("/settings");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/40 border-t-primary" />
          <p className="text-sm text-zinc-500">Loading TradeFix…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen [height:100dvh] flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <MobileNav />
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main
        className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
          isDashboard || isSettings ? "" : "overflow-y-auto p-6 sm:p-8"
        } ${isSettings ? "overflow-y-auto" : ""}`}
      >
        {children}
      </main>
      <AddTradeModal />
    </div>
  );
}

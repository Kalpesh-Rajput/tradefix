"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountProvider } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { QuickLogProvider } from "@/components/providers/QuickLogProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";
import { AddTradeModal } from "@/components/trade/AddTradeModal";
import { useLiveAccount } from "@/lib/hooks/useLiveAccount";

function LiveAccountBridge() {
  useLiveAccount(true);
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/today";
  const isTradesLog = pathname === "/trades";
  const isCalendar = pathname === "/calendar";
  const isDiary = pathname === "/diary";
  const isSettings = pathname?.startsWith("/settings");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.onboarding_completed_at) {
      router.replace("/onboarding");
    }
  }, [loading, user, router]);

  if (loading || !user || !user.onboarding_completed_at) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary/40 border-t-primary" />
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <AccountProvider>
      <QuickLogProvider>
        <SidebarProvider>
          <LiveAccountBridge />
          <div className="flex h-screen [height:100dvh] flex-col overflow-hidden bg-background text-foreground md:flex-row">
            <MobileNav />
            <div className="hidden md:block">
              <Sidebar />
            </div>
            <main
              className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
                isDashboard || isSettings || isTradesLog || isCalendar || isDiary
                  ? ""
                  : "overflow-y-auto p-6 sm:p-8"
              } ${isSettings ? "overflow-y-auto" : ""}`}
            >
              {children}
            </main>
            <AddTradeModal />
          </div>
        </SidebarProvider>
      </QuickLogProvider>
    </AccountProvider>
  );
}

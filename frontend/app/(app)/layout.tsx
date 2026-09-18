"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { AppNavigationProvider } from "@/components/layout/AppNavigation";
import { HeaderActionsProvider } from "@/components/layout/HeaderActions";
import { MobileNav } from "@/components/layout/MobileNav";
import { ProductRail } from "@/components/layout/ProductRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { AccountProvider } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConnectorsProvider } from "@/components/providers/ConnectorsProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { QuickLogProvider } from "@/components/providers/QuickLogProvider";
import { SidebarProvider, useSidebar } from "@/components/providers/SidebarProvider";
import { AddTradesFlow } from "@/components/add-trades/AddTradesFlow";
import { AddTradeModal } from "@/components/trade/AddTradeModal";
import { MonthlyGoalPrompt } from "@/components/goals/MonthlyGoalPrompt";
import { useLiveAccount } from "@/lib/hooks/useLiveAccount";
import { isJournalPath } from "@/lib/nav";

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
  const isDayView = pathname === "/day";
  const isHome = pathname === "/home";
  const isTradesLog = pathname === "/trades";
  const isCalendar = pathname === "/calendar";
  const isDiary = pathname === "/diary";
  const isMyDay = pathname === "/my-day" || pathname?.startsWith("/my-day/");
  const isNotebook = pathname === "/notebook";
  const isSettings = pathname?.startsWith("/settings");
  const isReports = pathname === "/analytics" || pathname?.startsWith("/analytics/");
  const isProgressTracker = pathname === "/progress-tracker" || pathname?.startsWith("/progress-tracker/");
  const isPlaybooks = pathname === "/playbooks" || pathname?.startsWith("/playbooks/");
  const isMarketSessions = pathname === "/market-sessions" || pathname?.startsWith("/market-sessions/");
  const showJournalNav = isJournalPath(pathname);

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
    <ConnectorsProvider enabled>
      <AccountProvider>
        <QuickLogProvider>
          <SidebarProvider>
            <AppNavigationProvider>
              <LiveAccountBridge />
              <AppShell
                showJournalNav={showJournalNav}
                isDashboard={isDashboard}
                isDayView={isDayView}
                isHome={isHome}
                isTradesLog={isTradesLog}
                isCalendar={isCalendar}
                isDiary={isDiary}
                isMyDay={isMyDay}
                isNotebook={isNotebook}
                isSettings={isSettings}
                isReports={isReports}
                isProgressTracker={isProgressTracker}
                isPlaybooks={isPlaybooks}
                isMarketSessions={isMarketSessions}
              >
                {children}
              </AppShell>
              <AddTradesFlow />
              <AddTradeModal />
              <MonthlyGoalPrompt />
            </AppNavigationProvider>
          </SidebarProvider>
        </QuickLogProvider>
      </AccountProvider>
    </ConnectorsProvider>
  );
}

function AppShell({
  children,
  showJournalNav,
  isDashboard,
  isDayView,
  isHome,
  isTradesLog,
  isCalendar,
  isDiary,
  isMyDay,
  isNotebook,
  isSettings,
  isReports,
  isProgressTracker,
  isPlaybooks,
  isMarketSessions,
}: {
  children: React.ReactNode;
  showJournalNav: boolean;
  isDashboard: boolean;
  isDayView: boolean;
  isHome: boolean;
  isTradesLog: boolean;
  isCalendar: boolean;
  isDiary: boolean;
  isMyDay: boolean;
  isNotebook: boolean;
  isSettings: boolean;
  isReports: boolean;
  isProgressTracker: boolean;
  isPlaybooks: boolean;
  isMarketSessions: boolean;
}) {
  const { collapsed, setCollapsed } = useSidebar();

  useEffect(() => {
    if (!showJournalNav) setCollapsed(true);
  }, [showJournalNav, setCollapsed]);

  return (
    <div className="flex h-screen [height:100dvh] overflow-hidden bg-sidebar text-foreground">
      <div className="relative z-50 hidden h-full md:flex">
        <ProductRail />
      </div>
      <MobileNav />
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!collapsed && showJournalNav && (
          <div className="hidden h-full md:flex">
            <Sidebar />
          </div>
        )}
        <HeaderActionsProvider>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-surface)]">
            {!isTradesLog && <AppHeader />}
            <main
              className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
                isDashboard || isDayView || isHome || isSettings || isTradesLog || isCalendar || isDiary || isMyDay || isNotebook || isReports || isProgressTracker || isPlaybooks || isMarketSessions
                  ? ""
                  : "overflow-y-auto p-6 sm:p-8"
              } ${isSettings || isHome ? "overflow-y-auto" : ""}`}
            >
              {children}
            </main>
          </div>
        </HeaderActionsProvider>
      </div>
    </div>
  );
}

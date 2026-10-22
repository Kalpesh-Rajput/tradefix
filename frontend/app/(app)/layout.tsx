"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { PageTransition } from "@/components/motion/PageTransition";
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
import { TradeFixAIWidget } from "@/components/tradefix-ai/assistant/TradeFixAIWidget";
import { TradeFixAssistantProvider } from "@/components/tradefix-ai/assistant/TradeFixAssistantProvider";
import { AddTradesFlow } from "@/components/add-trades/AddTradesFlow";
import { AddTradeModal } from "@/components/trade/AddTradeModal";
import { Spinner } from "@/components/ui/Spinner";
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
  const isNews = pathname === "/news" || pathname?.startsWith("/news/");
  const isChat = pathname === "/chat" || pathname?.startsWith("/chat/");
  const isTradeFiz = pathname === "/tradefiz-ai" || pathname?.startsWith("/tradefiz-ai/");
  const isTradeFizAgent = pathname === "/tradefiz-ai/chat" || pathname?.startsWith("/tradefiz-ai/chat/");
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
      <div className="flex h-screen items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-7 w-7 border-[2.5px] text-primary" />
          <p className="text-[13px] font-medium text-muted">{t("common.loading")}</p>
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
              <TradeFixAssistantProvider>
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
                isNews={isNews}
                isChat={isChat}
                isTradeFiz={isTradeFiz}
                isTradeFizAgent={isTradeFizAgent}
              >
                {children}
              </AppShell>
              <AddTradesFlow />
              <AddTradeModal />
              <MonthlyGoalPrompt />
              </TradeFixAssistantProvider>
            </AppNavigationProvider>
          </SidebarProvider>
        </QuickLogProvider>
      </AccountProvider>
    </ConnectorsProvider>
  );
}

function isSessionDesk(pathname: string | null): boolean {
  return /^\/backtest\/sessions\/(?!new$)[^/]+$/.test(pathname ?? "");
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
  isNews,
  isChat,
  isTradeFiz,
  isTradeFizAgent,
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
  isNews: boolean;
  isChat: boolean;
  isTradeFiz: boolean;
  isTradeFizAgent: boolean;
}) {
  const { collapsed, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const sessionDesk = isSessionDesk(pathname);

  useEffect(() => {
    if (!showJournalNav) setCollapsed(true);
  }, [showJournalNav, setCollapsed]);

  return (
    <div className="flex h-screen [height:100dvh] overflow-hidden bg-sidebar text-foreground">
      {!isTradeFizAgent && (
        <div className="relative z-50 hidden h-full md:flex">
          <ProductRail />
        </div>
      )}
      <MobileNav />
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!collapsed && showJournalNav && !isTradeFizAgent && (
          <div className="hidden h-full md:flex">
            <Sidebar />
          </div>
        )}
        <HeaderActionsProvider>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-surface)]">
              {!isTradesLog && !isTradeFizAgent && <AppHeader />}
              <main
                className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
                  sessionDesk || isDashboard || isDayView || isHome || isSettings || isTradesLog || isCalendar || isDiary || isMyDay || isNotebook || isReports || isProgressTracker || isPlaybooks || isMarketSessions || isNews || isChat || isTradeFiz
                    ? ""
                    : "overflow-y-auto p-6 sm:p-8"
                } ${isSettings || isHome ? "overflow-y-auto" : ""} ${sessionDesk ? "overflow-hidden bg-background p-3 sm:p-4" : ""}`}
              >
                <PageTransition className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</PageTransition>
              </main>
              <TradeFixAIWidget />
            </div>
        </HeaderActionsProvider>
      </div>
    </div>
  );
}

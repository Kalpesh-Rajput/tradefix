"use client";

import clsx from "clsx";
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Globe,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Plus,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import { LayoutGroup, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";

import { NavCollapseButton } from "@/components/layout/NavCollapseButton";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import type { MessageKey } from "@/lib/i18n";
import { isSidebarNavActive } from "@/lib/nav";

const NAV_WIDTH = "w-[188px]";

const NAV: {
  href: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
  testId: string;
}[] = [
  { href: "/today", labelKey: "nav.today", icon: LayoutDashboard, testId: "nav-today" },
  { href: "/tradefiz-ai", labelKey: "nav.tradefizAi", icon: Sparkles, testId: "nav-tradefiz-ai" },
  { href: "/day", labelKey: "nav.dayView", icon: Sun, testId: "nav-dayView" },
  { href: "/trades", labelKey: "nav.tradeLog", icon: ClipboardList, testId: "nav-tradeLog" },
  { href: "/notebook", labelKey: "nav.notebook", icon: BookOpen, testId: "nav-notebook" },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3, testId: "nav-analytics" },
  { href: "/progress-tracker", labelKey: "nav.progressTracker", icon: Target, testId: "nav-progressTracker" },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays, testId: "nav-calendar" },
  { href: "/market-sessions", labelKey: "nav.marketSessions", icon: Globe, testId: "nav-marketSessions" },
  { href: "/playbooks", labelKey: "nav.tradingPlan", icon: ListChecks, testId: "nav-playbooks" },
  { href: "/mindset", labelKey: "nav.mindset", icon: Brain, testId: "nav-mindset" },
  { href: "/news", labelKey: "nav.news", icon: Newspaper, testId: "nav-news" },
  { href: "/portfolio", labelKey: "nav.portfolio", icon: Briefcase, testId: "nav-portfolio" },
];

export function Sidebar({
  forceExpanded = false,
  showEdgeToggle = false,
}: {
  forceExpanded?: boolean;
  showEdgeToggle?: boolean;
  /** @deprecated kept for MobileNav compat */
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { openFlow } = useAddTradeModal();
  const { setMobileOpen } = useSidebar();
  const { resolvedTheme, semanticChrome } = useAppearance();
  const original = resolvedTheme === "tradefix-purple" && !semanticChrome;
  const groupId = useId();

  void forceExpanded;
  void showEdgeToggle;

  return (
    <aside
      className={clsx(
        "sidebar-chrome nav-column flex h-full shrink-0 flex-col overflow-hidden border-r bg-sidebar py-3",
        original ? "border-white/[0.06] text-white" : "border-sidebar-border text-sidebar-foreground",
        NAV_WIDTH
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-2.5">
        <span
          className={clsx(
            "truncate text-[18px] font-bold leading-none tracking-tight",
            original ? "text-white" : "text-sidebar-foreground"
          )}
        >
          Trade
          {original ? (
            <span className="bg-gradient-to-r from-[#A78BFA] to-[#7C5CBF] bg-clip-text text-transparent">Fix</span>
          ) : (
            <span className="spectrum-wordmark text-primary">Fix</span>
          )}
        </span>
        <NavCollapseButton />
      </div>
      <div className="mb-2 px-2.5">
        <button
          type="button"
          onClick={() => {
            openFlow();
            setMobileOpen(false);
          }}
          className="group inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-semibold text-primary-foreground text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-[background-color,transform] duration-150 hover:bg-primary-hover active:scale-[0.98] motion-reduce:active:scale-100"
          aria-label={t("common.addTrade")}
          data-testid="sidebar-add-trade"
        >
          <Plus className="tf-icon-plus h-4 w-4" strokeWidth={2.25} aria-hidden />
          {t("common.addTrade")}
        </button>
      </div>

      <LayoutGroup id={groupId}>
        <nav className="nav-column flex w-full flex-1 flex-col gap-px overflow-y-auto px-1.5" aria-label="Journal">
          {NAV.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey);
            const active = isSidebarNavActive(pathname, item.href);

            return (
              <Link
                key={item.testId}
                href={item.href}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "group relative isolate flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-left text-[13px] font-medium transition-colors duration-200 ease-out motion-reduce:transition-none",
                  active
                    ? original
                      ? "font-semibold text-white"
                      : "nav-active-label font-semibold"
                    : original
                      ? "text-[#b8b4d4] hover:bg-white/[0.06] hover:text-white"
                      : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="journal-nav-active"
                    aria-hidden
                    className={clsx(
                      "absolute inset-0 -z-10 rounded-md",
                      original ? "bg-[#7C5CBF]/25" : "bg-sidebar-active"
                    )}
                    transition={{ type: "spring", stiffness: 520, damping: 44, mass: 0.7 }}
                  >
                    <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[var(--color-sidebar-indicator,var(--color-primary))] shadow-[0_0_10px_var(--color-sidebar-indicator,var(--color-primary))]" />
                  </motion.span>
                )}
                <Icon
                  className={clsx(
                    "h-[17px] w-[17px] shrink-0 transition-[color,transform] duration-200 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100",
                    active ? "text-[var(--color-sidebar-indicator,var(--color-primary))]" : "text-[var(--color-sidebar-icon)] group-hover:text-current"
                  )}
                  strokeWidth={active ? 2 : 1.75}
                  aria-hidden
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </aside>
  );
}

"use client";

import clsx from "clsx";
import {
  BarChart3,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  NotebookPen,
  Plus,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import type { MessageKey } from "@/lib/i18n";

const NAV_WIDTH = "w-[220px]";

const NAV: {
  href: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
  testId: string;
  iconColor: string;
}[] = [
  { href: "/today", labelKey: "nav.today", icon: LayoutDashboard, testId: "nav-today", iconColor: "#7C5CBF" },
  { href: "/day", labelKey: "nav.dayView", icon: Sun, testId: "nav-dayView", iconColor: "#F59E0B" },
  { href: "/diary", labelKey: "nav.journal", icon: NotebookPen, testId: "nav-journal", iconColor: "#3B82F6" },
  { href: "/trades", labelKey: "nav.tradeLog", icon: ClipboardList, testId: "nav-tradeLog", iconColor: "#EC4899" },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3, testId: "nav-analytics", iconColor: "#10B981" },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays, testId: "nav-calendar", iconColor: "#6366F1" },
  { href: "/trading-plan", labelKey: "nav.tradingPlan", icon: ListChecks, testId: "nav-tradingPlan", iconColor: "#F97316" },
  { href: "/mindset", labelKey: "nav.mindset", icon: Brain, testId: "nav-mindset", iconColor: "#A855F7" },
  { href: "/news", labelKey: "nav.news", icon: Newspaper, testId: "nav-news", iconColor: "#64748B" },
  { href: "/portfolio", labelKey: "nav.portfolio", icon: Briefcase, testId: "nav-portfolio", iconColor: "#0EA5E9" },
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
  const { openModal } = useAddTradeModal();
  const { setMobileOpen } = useSidebar();

  void forceExpanded;
  void showEdgeToggle;

  return (
    <aside
      className={clsx(
        "nav-column flex h-full shrink-0 flex-col overflow-hidden border-r border-black/[0.06] bg-[#f4f5f7] py-3 text-[var(--color-text-primary)] dark:border-white/[0.06] dark:bg-[var(--color-surface-secondary)]",
        NAV_WIDTH
      )}
    >
      <div className="mb-2 px-2.5">
        <button
          type="button"
          onClick={() => {
            openModal("manual");
            setMobileOpen(false);
          }}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-semibold text-primary-foreground text-on-accent transition-colors duration-150 hover:bg-primary-hover"
          title={t("common.addTrade")}
          aria-label={t("common.addTrade")}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {t("common.addTrade")}
        </button>
      </div>

      <nav className="nav-column flex w-full flex-1 flex-col gap-px overflow-y-auto px-1.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const active =
            pathname === item.href ||
            (item.href !== "/today" && Boolean(pathname?.startsWith(item.href + "/")));

          return (
            <Link
              key={item.testId}
              href={item.href}
              title={label}
              data-testid={item.testId}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "relative flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-left text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-[var(--color-text-secondary)] hover:bg-black/[0.04] hover:text-[var(--color-text-primary)] dark:hover:bg-white/[0.06]"
              )}
            >
              <Icon
                className="h-[17px] w-[17px] shrink-0"
                style={{ color: item.iconColor }}
                strokeWidth={active ? 2 : 1.75}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

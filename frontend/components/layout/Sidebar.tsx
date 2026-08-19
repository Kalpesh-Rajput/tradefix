"use client";

import clsx from "clsx";
import {
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  Newspaper,
  NotebookPen,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { BrandLockup } from "@/components/ui/Logo";
import { firstName } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";

const SIDEBAR_EXPANDED = "w-[196px]";
const SIDEBAR_COLLAPSED = "w-[64px]";

const NAV: {
  href: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
  testId: string;
  /** Accent color for the nav icon on the dark sidebar */
  iconColor: string;
}[] = [
  { href: "/today", labelKey: "nav.today", icon: LayoutDashboard, testId: "nav-today", iconColor: "#A78BFA" },
  { href: "/diary", labelKey: "nav.journal", icon: NotebookPen, testId: "nav-journal", iconColor: "#60A5FA" },
  { href: "/trades", labelKey: "nav.tradeLog", icon: ClipboardList, testId: "nav-tradeLog", iconColor: "#F472B6" },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3, testId: "nav-analytics", iconColor: "#34D399" },
  { href: "/agents", labelKey: "nav.agents", icon: Bot, testId: "nav-agents", iconColor: "#FBBF24" },
  { href: "/wiki", labelKey: "nav.wiki", icon: GraduationCap, testId: "nav-wiki", iconColor: "#22D3EE" },
  { href: "/trading-plan", labelKey: "nav.tradingPlan", icon: ListChecks, testId: "nav-tradingPlan", iconColor: "#FB923C" },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays, testId: "nav-calendar", iconColor: "#818CF8" },
  { href: "/backtest", labelKey: "nav.backtest", icon: FlaskConical, testId: "nav-backtesting", iconColor: "#4ADE80" },
  { href: "/coach", labelKey: "nav.mentor", icon: Users, testId: "nav-mentor", iconColor: "#E879F9" },
  { href: "/portfolio", labelKey: "nav.portfolio", icon: Briefcase, testId: "nav-portfolio", iconColor: "#38BDF8" },
  { href: "/chat", labelKey: "nav.coach", icon: MessageSquare, testId: "nav-coach", iconColor: "#F87171" },
  { href: "/mindset", labelKey: "nav.mindset", icon: Brain, testId: "nav-mindset", iconColor: "#C084FC" },
  { href: "/news", labelKey: "nav.news", icon: Newspaper, testId: "nav-news", iconColor: "#94A3B8" },
];

export function Sidebar({
  forceExpanded = false,
  showEdgeToggle = true,
}: {
  /** Mobile drawer should always show labels */
  forceExpanded?: boolean;
  showEdgeToggle?: boolean;
  /** @deprecated kept for MobileNav compat */
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { openModal } = useAddTradeModal();
  const { collapsed, toggle } = useSidebar();
  const name = firstName(user?.name, user?.email);
  const initial = name.slice(0, 1).toUpperCase();

  const isCollapsed = forceExpanded ? false : collapsed;
  const widthClass = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <div className={clsx("relative shrink-0 transition-[width] duration-200 ease-out", widthClass)}>
      <aside
        className={clsx(
          "sidebar-chrome absolute left-0 top-0 z-40 flex h-screen [height:100dvh] flex-col overflow-hidden border-r border-sidebar-divider bg-sidebar py-4 text-sidebar-foreground transition-[width] duration-200 ease-out",
          widthClass
        )}
      >
        <Link
          href="/today"
          className={clsx(
            "mb-5 flex shrink-0 items-center",
            isCollapsed ? "justify-center px-2" : "px-3"
          )}
          title="TradeFix"
        >
          <BrandLockup collapsed={isCollapsed} />
        </Link>

        <div className={clsx("mb-4", isCollapsed ? "px-2" : "px-4")}>
          <button
            type="button"
            onClick={() => openModal("manual")}
            className={clsx(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-[12px] font-medium text-primary-foreground text-on-accent transition-colors duration-150 hover:bg-primary-hover",
              isCollapsed ? "w-full px-0" : "w-full"
            )}
            title={t("common.addTrade")}
            aria-label={t("common.addTrade")}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            {!isCollapsed && t("common.addTrade")}
          </button>
        </div>

        <nav
          className={clsx(
            "sidebar-scroll flex w-full flex-1 flex-col gap-0.5 overflow-y-auto",
            isCollapsed ? "px-1.5" : "px-2.5"
          )}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey);
            const active =
              pathname === item.href ||
              (item.href !== "/today" && Boolean(pathname?.startsWith(item.href + "/")));
            const key = `${item.labelKey}-${item.href}-${item.testId}`;

            return (
              <Link
                key={key}
                href={item.href}
                title={label}
                data-testid={item.testId}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center text-left text-[12px] font-medium transition-colors duration-150",
                  isCollapsed
                    ? "justify-center rounded-md px-0 py-2.5"
                    : "w-full gap-2.5 rounded-r-md py-[7px] pl-2.5 pr-2.5",
                  active
                    ? "bg-primary/25 font-semibold text-white shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                )}
              >
                <Icon
                  className="h-[17px] w-[17px] shrink-0"
                  style={{ color: item.iconColor }}
                  strokeWidth={active ? 2 : 1.75}
                  aria-hidden
                />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div
          className={clsx(
            "mt-2 flex w-full border-t border-sidebar-divider pt-3",
            isCollapsed ? "flex-col items-center gap-1 px-1.5" : "items-center gap-1 px-2.5"
          )}
        >
          <Link
            href="/settings/profile"
            className={clsx(
              "flex items-center rounded-md transition-colors duration-150 hover:bg-sidebar-hover",
              isCollapsed ? "justify-center p-1.5" : "min-w-0 flex-1 gap-2.5 px-2 py-2"
            )}
            title={t("common.settings")}
          >
            <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(user.avatar_url) || undefined}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/10 text-[11px] font-semibold text-white">
                  {initial}
                </span>
              )}
            </span>
            {!isCollapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-white">
                  {user?.name || name}
                </span>
                <span className="block truncate text-[10.5px] text-sidebar-muted">{user?.email}</span>
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors duration-150 hover:bg-destructive/20 hover:text-red-300"
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
            data-testid="nav-sign-out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {showEdgeToggle && !forceExpanded && (
        <button
          type="button"
          onClick={toggle}
          className="absolute -right-3 top-[52px] z-50 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-primary"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      )}
    </div>
  );
}

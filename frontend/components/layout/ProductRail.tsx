"use client";

import clsx from "clsx";
import { LayoutGroup, motion } from "framer-motion";
import {
  Bot,
  FlaskConical,
  Gift,
  GraduationCap,
  HelpCircle,
  Home,
  MonitorPlay,
  NotebookPen,
  Star,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";

import { RailProfile } from "@/components/layout/RailProfile";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { BrandLockup } from "@/components/ui/Logo";
import type { MessageKey } from "@/lib/i18n";
import { isJournalPath } from "@/lib/nav";

const COLLAPSED = 64;
const EXPANDED = 220;

type RailItem = {
  href: string;
  labelKey: MessageKey;
  icon: typeof Home;
  testId: string;
  badge?: "new";
  isActive: (pathname: string) => boolean;
};

const PRIMARY: RailItem[] = [
  {
    href: "/home",
    labelKey: "nav.home",
    icon: Home,
    testId: "rail-home",
    isActive: (p) => p === "/home",
  },
  {
    href: "/today",
    labelKey: "nav.journalHub",
    icon: NotebookPen,
    testId: "rail-journal",
    isActive: (p) => isJournalPath(p),
  },
  {
    href: "/backtest",
    labelKey: "nav.backtesting",
    icon: FlaskConical,
    testId: "rail-backtest",
    isActive: (p) => p === "/backtest" || p.startsWith("/backtest/"),
  },
  {
    href: "/agents",
    labelKey: "nav.agents",
    icon: Bot,
    testId: "rail-agents",
    isActive: (p) => p === "/agents" || p.startsWith("/agents/"),
  },
  {
    href: "/coach",
    labelKey: "nav.mentor",
    icon: MonitorPlay,
    testId: "rail-mentor",
    isActive: (p) => p === "/coach" || p.startsWith("/coach/"),
  },
  {
    href: "/settings/prop-firm",
    labelKey: "nav.propFirmSync",
    icon: Star,
    testId: "rail-propfirm",
    badge: "new",
    isActive: (p) => p.startsWith("/settings/prop-firm"),
  },
];

const SECONDARY: RailItem[] = [
  {
    href: "/settings/support",
    labelKey: "nav.help",
    icon: HelpCircle,
    testId: "rail-help",
    isActive: (p) => p.startsWith("/settings/support"),
  },
  {
    href: "/wiki",
    labelKey: "nav.university",
    icon: GraduationCap,
    testId: "rail-university",
    isActive: (p) => p === "/wiki" || p.startsWith("/wiki/"),
  },
  {
    href: "/perks",
    labelKey: "nav.referral",
    icon: Gift,
    testId: "rail-referral",
    isActive: (p) => p === "/perks",
  },
];

export function ProductRail({
  forceExpanded = false,
}: {
  forceExpanded?: boolean;
}) {
  const pathname = usePathname() || "";
  const { t } = useLocale();
  const { setMobileOpen, setCollapsed } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const expanded = forceExpanded || hovered;
  const groupId = useId();

  function openRail() {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    setHovered(true);
  }

  function closeRail() {
    if (forceExpanded) return;
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHovered(false), 120);
  }

  return (
    <div
      className="relative h-full shrink-0"
      style={{ width: forceExpanded ? EXPANDED : COLLAPSED }}
    >
      <aside
        className={clsx(
          "sidebar-chrome flex h-full flex-col overflow-hidden bg-sidebar py-3 text-sidebar-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none",
          forceExpanded ? "relative w-full" : "absolute inset-y-0 left-0 z-50",
          !forceExpanded && expanded && "shadow-xl"
        )}
        style={forceExpanded ? undefined : { width: expanded ? EXPANDED : COLLAPSED }}
        onMouseEnter={openRail}
        onMouseLeave={closeRail}
        onFocus={openRail}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) closeRail();
        }}
        aria-label="Product navigation"
      >
        <div className={clsx("mb-2 flex", expanded ? "px-2.5" : "justify-center px-0")}>
          <Link href="/home" title="TradeFix" className="min-w-0" onClick={() => setMobileOpen(false)}>
            <BrandLockup collapsed={!expanded} />
          </Link>
        </div>
        <LayoutGroup id={groupId}>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {PRIMARY.map((item) => (
            <RailNavLink
              key={item.href}
              item={item}
              expanded={expanded}
              active={item.isActive(pathname)}
              label={t(item.labelKey)}
              newLabel={t("common.new")}
              onNavigate={() => {
                setMobileOpen(false);
                if (item.href === "/today") setCollapsed(false);
              }}
            />
          ))}
        </nav>

        <nav className="mt-auto flex flex-col gap-1 px-2 pb-1">
          {SECONDARY.map((item) => (
            <RailNavLink
              key={item.href}
              item={item}
              expanded={expanded}
              active={item.isActive(pathname)}
              label={t(item.labelKey)}
              newLabel={t("common.new")}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>
        </LayoutGroup>
        <div className={clsx("flex pt-2", expanded ? "px-2.5" : "justify-center px-0")}>
          <RailProfile />
        </div>
      </aside>
    </div>
  );
}

function RailNavLink({
  item,
  expanded,
  active,
  label,
  newLabel,
  onNavigate,
}: {
  item: RailItem;
  expanded: boolean;
  active: boolean;
  label: string;
  newLabel: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-testid={item.testId}
      onClick={onNavigate}
      className={clsx(
        "group relative isolate flex h-9 items-center rounded-md text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none",
        expanded ? "px-2.5" : "justify-center px-0",
        active
          ? "text-primary-foreground"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          aria-hidden
          className="absolute inset-0 -z-10 rounded-md bg-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_6px_16px_-8px_hsl(var(--primary)/0.7)]"
          transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
        />
      )}
      <Icon
        className="h-[18px] w-[18px] shrink-0 transition-transform duration-base ease-out-expo group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        strokeWidth={active ? 2 : 1.75}
        aria-hidden
      />
      <span
        className={clsx(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 motion-reduce:transition-none",
          expanded ? "ml-2.5 max-w-[148px] opacity-100" : "ml-0 max-w-0 opacity-0"
        )}
      >
        {label}
      </span>
      {item.badge === "new" && (
        <span
          className={clsx(
            "shrink-0 rounded-[3px] bg-warning-bg px-1 text-[8px] font-bold leading-[14px] tracking-wide text-[var(--color-warning-text)]",
            expanded ? "ml-auto" : "absolute -right-0.5 -top-0.5"
          )}
        >
          {newLabel}
        </span>
      )}
    </Link>
  );
}

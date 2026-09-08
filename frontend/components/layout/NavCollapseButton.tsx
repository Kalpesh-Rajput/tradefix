"use client";

import clsx from "clsx";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";

export function NavCollapseButton({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const { collapsed, toggle } = useSidebar();
  const { t } = useLocale();
  const Icon = collapsed ? ChevronsRight : ChevronsLeft;
  const label = collapsed ? t("common.showNav") : t("common.hideNav");

  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx(
        "hidden h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 md:inline-flex",
        variant === "dark"
          ? "text-white/80 hover:bg-white/10 hover:text-white"
          : "text-[var(--color-text-secondary)] hover:bg-black/[0.05] hover:text-[var(--color-text-primary)]",
        className
      )}
      aria-label={label}
      title={label}
      data-testid="nav-collapse"
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Logo } from "@/components/ui/Logo";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <Logo size={32} showWordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border bg-card p-2 text-muted shadow-sm"
          aria-label={t("common.openMenu")}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t("common.closeMenu")}
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[196px] shadow-lift" onClick={() => setOpen(false)}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 z-10 rounded-lg p-1.5 text-sidebar-muted"
              aria-label={t("common.closeMenu")}
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar forceExpanded showEdgeToggle={false} />
          </div>
        </div>
      )}
    </>
  );
}

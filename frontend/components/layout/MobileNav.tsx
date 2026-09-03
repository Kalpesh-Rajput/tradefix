"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { ProductRail } from "@/components/layout/ProductRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { isJournalPath } from "@/lib/nav";

export function MobileNav() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { t } = useLocale();
  const pathname = usePathname();
  const showJournalNav = isJournalPath(pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, setMobileOpen]);

  if (!mobileOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t("common.closeMenu")}
        onClick={() => setMobileOpen(false)}
      />
      <div className="relative flex h-full max-w-[100vw] overflow-hidden rounded-r-xl shadow-lift">
        <ProductRail forceExpanded />
        {showJournalNav && <Sidebar forceExpanded showEdgeToggle={false} />}
      </div>
    </div>
  );
}

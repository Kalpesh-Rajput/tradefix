"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ProductRail } from "@/components/layout/ProductRail";
import { Sidebar } from "@/components/layout/Sidebar";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { MOTION } from "@/lib/motion";
import { isJournalPath } from "@/lib/nav";

export function MobileNav() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const { t } = useLocale();
  const pathname = usePathname();
  const showJournalNav = isJournalPath(pathname);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [mobileOpen, setMobileOpen]);

  return (
    <AnimatePresence>
      {mobileOpen && (
        <div className="fixed inset-0 z-overlay md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <motion.button
            type="button"
            {...MOTION.fade}
            className="tf-overlay-scrim absolute inset-0"
            aria-label={t("common.closeMenu")}
            onClick={() => setMobileOpen(false)}
          />
          <motion.div
            ref={panelRef}
            {...MOTION.drawerLeft}
            className="relative flex h-full max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-r-xl shadow-dropdown"
          >
            <ProductRail forceExpanded={!showJournalNav} />
            {showJournalNav && <Sidebar forceExpanded showEdgeToggle={false} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

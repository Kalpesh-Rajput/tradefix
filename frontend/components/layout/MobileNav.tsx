"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Sidebar } from "@/components/layout/Sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-black px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-white">
            trade<span className="text-primary">fix</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-white/10 p-2 text-zinc-500"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[220px] shadow-lift" onClick={() => setOpen(false)}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 z-10 rounded-lg p-1.5 text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar expanded />
          </div>
        </div>
      )}
    </>
  );
}

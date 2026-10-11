"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { AdvancedFilters } from "@/lib/reports/advanced/query";
import type { DrillRef } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { DrilldownDrawer } from "./DrilldownDrawer";

type OpenDrill = (drill: DrillRef, title: string) => void;

const DrillCtx = createContext<OpenDrill | null>(null);

export function DrillProvider({
  filters,
  formatMoney,
  periodLabel,
  children,
}: {
  filters: AdvancedFilters;
  formatMoney: MoneyFormatter;
  periodLabel: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ drill: DrillRef; title: string } | null>(null);
  const open = useCallback<OpenDrill>((drill, title) => setState({ drill, title }), []);
  const value = useMemo(() => open, [open]);
  return (
    <DrillCtx.Provider value={value}>
      {children}
      {state ? (
        <DrilldownDrawer
          filters={filters}
          drill={state.drill}
          title={state.title}
          periodLabel={periodLabel}
          formatMoney={formatMoney}
          onClose={() => setState(null)}
        />
      ) : null}
    </DrillCtx.Provider>
  );
}

export function useDrill(): OpenDrill {
  const ctx = useContext(DrillCtx);
  if (!ctx) throw new Error("useDrill must be used inside DrillProvider");
  return ctx;
}

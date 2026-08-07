"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { QuickLogModal } from "@/components/trade/QuickLogModal";

type QuickLogContextValue = {
  openQuickLog: (tradeId?: string | null) => void;
  closeQuickLog: () => void;
};

const QuickLogContext = createContext<QuickLogContextValue | undefined>(undefined);

export function QuickLogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tradeId, setTradeId] = useState<string | null>(null);

  const openQuickLog = useCallback((id?: string | null) => {
    setTradeId(id ?? null);
    setOpen(true);
  }, []);

  const closeQuickLog = useCallback(() => {
    setOpen(false);
    setTradeId(null);
  }, []);

  const value = useMemo(
    () => ({ openQuickLog, closeQuickLog }),
    [openQuickLog, closeQuickLog]
  );

  return (
    <QuickLogContext.Provider value={value}>
      {children}
      <QuickLogModal open={open} tradeId={tradeId} onClose={closeQuickLog} />
    </QuickLogContext.Provider>
  );
}

export function useQuickLog() {
  const ctx = useContext(QuickLogContext);
  if (!ctx) throw new Error("useQuickLog must be used within QuickLogProvider");
  return ctx;
}

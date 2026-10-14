"use client";

import { useMemo } from "react";

import { createCandleSource } from "@/lib/backtest/marketClient";
import type { CandleSource } from "@/lib/backtest/types";

export function useCandleSource(symbol: string | null): CandleSource | null {
  return useMemo(() => (symbol ? createCandleSource(symbol) : null), [symbol]);
}

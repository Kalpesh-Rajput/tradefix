"use client";

import { create } from "zustand";

type AddTradeTab = "manual" | "journal" | "csv" | "broker";

interface AddTradeModalState {
  open: boolean;
  flowOpen: boolean;
  tab: AddTradeTab;
  tradeId: string | null;
  /** Passed into BrokerConnectWizard when opening the broker tab from the flow. */
  initialBrokerId: string | null;
  /** Prefill the MT5/trade server field. */
  initialServer: string | null;
  /** Newly created account to preselect on the Add Trade form. */
  initialAccountId: string | null;
  openModal: (
    tab?: AddTradeTab,
    opts?: {
      initialBrokerId?: string | null;
      initialAccountId?: string | null;
      initialServer?: string | null;
    }
  ) => void;
  openEdit: (tradeId: string) => void;
  openFlow: () => void;
  closeFlow: () => void;
  closeModal: () => void;
  setTab: (tab: AddTradeTab) => void;
}

export function useAddTradeModal() {
  return useAddTradeModalStore();
}

const useAddTradeModalStore = create<AddTradeModalState>((set) => ({
  open: false,
  flowOpen: false,
  tab: "manual",
  tradeId: null,
  initialBrokerId: null,
  initialServer: null,
  initialAccountId: null,
  openModal: (tab = "manual", opts) =>
    set({
      open: true,
      flowOpen: false,
      tab,
      tradeId: null,
      initialBrokerId: opts?.initialBrokerId ?? null,
      initialServer: opts?.initialServer ?? null,
      initialAccountId: opts?.initialAccountId ?? null,
    }),
  openEdit: (tradeId) =>
    set({
      open: true,
      flowOpen: false,
      tab: "manual",
      tradeId,
      initialBrokerId: null,
      initialServer: null,
      initialAccountId: null,
    }),
  openFlow: () =>
    set({
      flowOpen: true,
      open: false,
      tradeId: null,
      initialBrokerId: null,
      initialServer: null,
      initialAccountId: null,
    }),
  closeFlow: () => set({ flowOpen: false }),
  closeModal: () =>
    set({ open: false, tradeId: null, initialBrokerId: null, initialServer: null, initialAccountId: null }),
  setTab: (tab) => set({ tab }),
}));

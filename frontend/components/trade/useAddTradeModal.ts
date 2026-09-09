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
  openModal: (tab?: AddTradeTab, opts?: { initialBrokerId?: string | null }) => void;
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
  openModal: (tab = "manual", opts) =>
    set({
      open: true,
      flowOpen: false,
      tab,
      tradeId: null,
      initialBrokerId: opts?.initialBrokerId ?? null,
    }),
  openEdit: (tradeId) =>
    set({ open: true, flowOpen: false, tab: "manual", tradeId, initialBrokerId: null }),
  openFlow: () =>
    set({ flowOpen: true, open: false, tradeId: null, initialBrokerId: null }),
  closeFlow: () => set({ flowOpen: false }),
  closeModal: () => set({ open: false, tradeId: null, initialBrokerId: null }),
  setTab: (tab) => set({ tab }),
}));

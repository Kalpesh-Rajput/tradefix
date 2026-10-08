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
  /** Cancel on the manual form returns to Select Import Method. */
  resumeFlow: boolean;
  openModal: (
    tab?: AddTradeTab,
    opts?: {
      initialBrokerId?: string | null;
      initialAccountId?: string | null;
      initialServer?: string | null;
      resumeFlow?: boolean;
    }
  ) => void;
  openEdit: (tradeId: string) => void;
  openFlow: () => void;
  closeFlow: () => void;
  closeModal: () => void;
  /** Close the form. When it was opened from Select Import Method, show that step again. */
  dismissModal: () => void;
  setTab: (tab: AddTradeTab) => void;
}

export function useAddTradeModal() {
  return useAddTradeModalStore();
}

export const useAddTradeModalStore = create<AddTradeModalState>((set) => ({
  open: false,
  flowOpen: false,
  tab: "manual",
  tradeId: null,
  initialBrokerId: null,
  initialServer: null,
  initialAccountId: null,
  resumeFlow: false,
  openModal: (tab = "manual", opts) =>
    set({
      open: true,
      flowOpen: false,
      tab,
      tradeId: null,
      initialBrokerId: opts?.initialBrokerId ?? null,
      initialServer: opts?.initialServer ?? null,
      initialAccountId: opts?.initialAccountId ?? null,
      resumeFlow: Boolean(opts?.resumeFlow),
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
      resumeFlow: false,
    }),
  openFlow: () =>
    set({
      flowOpen: true,
      open: false,
      tradeId: null,
      initialBrokerId: null,
      initialServer: null,
      initialAccountId: null,
      resumeFlow: false,
    }),
  closeFlow: () => set({ flowOpen: false }),
  closeModal: () =>
    set({
      open: false,
      tradeId: null,
      initialBrokerId: null,
      initialServer: null,
      initialAccountId: null,
      resumeFlow: false,
    }),
  dismissModal: () =>
    set((state) => ({
      open: false,
      flowOpen: state.resumeFlow ? true : state.flowOpen,
      tradeId: null,
      initialBrokerId: null,
      initialServer: null,
      initialAccountId: null,
      resumeFlow: state.resumeFlow,
    })),
  setTab: (tab) => set({ tab }),
}));

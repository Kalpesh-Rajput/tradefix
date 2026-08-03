"use client";

import { create } from "zustand";

type AddTradeTab = "manual" | "journal" | "csv" | "broker";

interface AddTradeModalState {
  open: boolean;
  tab: AddTradeTab;
  openModal: (tab?: AddTradeTab) => void;
  closeModal: () => void;
  setTab: (tab: AddTradeTab) => void;
}

export const useAddTradeModal = create<AddTradeModalState>((set) => ({
  open: false,
  tab: "manual",
  openModal: (tab = "manual") => set({ open: true, tab }),
  closeModal: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
}));

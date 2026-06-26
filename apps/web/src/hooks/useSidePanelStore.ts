"use client";

import { create } from "zustand";

interface SidePanelState {
  isOpen: boolean;
  panelType: "notifications" | "messages" | null;
  openPanel: (type: "notifications" | "messages") => void;
  closePanel: () => void;
}

export const useSidePanelStore = create<SidePanelState>((set) => ({
  isOpen: false,
  panelType: null,
  openPanel: (type) => set({ isOpen: true, panelType: type }),
  closePanel: () => set({ isOpen: false }),
}));

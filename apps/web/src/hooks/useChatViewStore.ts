'use client';

import { create } from 'zustand';

interface ChatViewState {
  isChatMode: boolean;
  toggleChatMode: () => void;
  setChatMode: (mode: boolean) => void;
}

export const useChatViewStore = create<ChatViewState>((set) => ({
  isChatMode: false,
  toggleChatMode: () => set((state) => ({ isChatMode: !state.isChatMode })),
  setChatMode: (mode: boolean) => set({ isChatMode: mode }),
}));

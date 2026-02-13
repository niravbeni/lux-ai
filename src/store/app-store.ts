import { create } from 'zustand';
import { DEFAULT_PRODUCT_ID } from '@/data/product-catalog';

export type AppScreen =
  | 'landing'
  | 'scanner'
  | 'transition'
  | 'viewer-hub'
  | 'colour-mode'
  | 'fit-mode'
  | 'details-mode'
  | 'save-modal';

export type OrbState = 'idle' | 'listening' | 'processing' | 'recognition' | 'speaking';

export type Colourway = {
  id: string;
  name: string;
  color: string;
  metalness: number;
  roughness: number;
};

export type FitResult = {
  lensWidth: string;
  fitNote: string;
};

export type ColourResult = {
  topMatch: Colourway;
  alternative: Colourway;
  reasoning: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface AppState {
  // Navigation
  screen: AppScreen;
  previousScreen: AppScreen | null;
  setScreen: (screen: AppScreen) => void;
  goBack: () => void;

  // Orb
  orbState: OrbState;
  setOrbState: (state: OrbState) => void;

  // Demo mode
  demoMode: boolean;
  setDemoMode: (demo: boolean) => void;

  // Product — active product from catalog
  activeProductId: string;
  previousProductId: string | null;
  setActiveProductId: (id: string) => void;

  scannedProductId: string | null;
  setScannedProductId: (id: string | null) => void;

  // Active colourway
  activeColourway: string;
  setActiveColourway: (id: string) => void;

  // Results
  colourResult: ColourResult | null;
  setColourResult: (result: ColourResult | null) => void;
  fitResult: FitResult | null;
  setFitResult: (result: FitResult | null) => void;

  // Voice
  transcript: string;
  setTranscript: (text: string) => void;
  isListening: boolean;
  setIsListening: (listening: boolean) => void;

  // Assistant message
  assistantMessage: string;
  setAssistantMessage: (msg: string) => void;

  // TTS
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;

  // Conversation mode — toggles between product view and orb chat
  isConversing: boolean;
  setIsConversing: (v: boolean) => void;

  // Chat history for multi-turn GPT conversation
  chatHistory: ChatMessage[];
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChatHistory: () => void;

  // Streaming text — displayed word-by-word over the orb
  streamingText: string;
  setStreamingText: (text: string) => void;

  // Recommended frame from AI (product id or null)
  recommendedProductId: string | null;
  setRecommendedProductId: (id: string | null) => void;

  // AI-recommended colourway (colourway id or null)
  aiRecommendedColourway: string | null;
  setAiRecommendedColourway: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  screen: 'landing',
  previousScreen: null,
  setScreen: (screen) => set({ screen, previousScreen: get().screen }),
  goBack: () => {
    const prev = get().previousScreen;
    if (prev) set({ screen: prev, previousScreen: null });
  },

  // Orb
  orbState: 'idle',
  setOrbState: (orbState) => set({ orbState }),

  // Demo mode
  demoMode: false,
  setDemoMode: (demoMode) => set({ demoMode }),

  // Product
  activeProductId: DEFAULT_PRODUCT_ID,
  previousProductId: null,
  setActiveProductId: (activeProductId) => {
    const current = get().activeProductId;
    if (activeProductId !== current) {
      set({ activeProductId, previousProductId: current });
    }
  },

  scannedProductId: null,
  setScannedProductId: (scannedProductId) => set({ scannedProductId }),

  // Active colourway
  activeColourway: 'shiny-black',
  setActiveColourway: (activeColourway) => set({ activeColourway }),

  // Results
  colourResult: null,
  setColourResult: (colourResult) => set({ colourResult }),
  fitResult: null,
  setFitResult: (fitResult) => set({ fitResult }),

  // Voice
  transcript: '',
  setTranscript: (transcript) => set({ transcript }),
  isListening: false,
  setIsListening: (isListening) => set({ isListening }),

  // Assistant message
  assistantMessage: '',
  setAssistantMessage: (assistantMessage) => set({ assistantMessage }),

  // TTS
  isSpeaking: false,
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),

  // Conversation mode
  isConversing: false,
  setIsConversing: (isConversing) => set({ isConversing }),

  // Chat history
  chatHistory: [],
  addChatMessage: (role, content) =>
    set((s) => ({ chatHistory: [...s.chatHistory, { role, content }] })),
  clearChatHistory: () => set({ chatHistory: [] }),

  // Streaming text
  streamingText: '',
  setStreamingText: (streamingText) => set({ streamingText }),

  // Recommended frame
  recommendedProductId: null,
  setRecommendedProductId: (recommendedProductId) => set({ recommendedProductId }),

  // AI-recommended colourway
  aiRecommendedColourway: null,
  setAiRecommendedColourway: (aiRecommendedColourway) => set({ aiRecommendedColourway }),
}));

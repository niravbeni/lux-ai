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

  // Frame carousel — ordered history of frames the user has viewed
  frameHistory: string[];
  frameHistoryIndex: number;
  addFrameToHistory: (id: string) => void;
  navigateCarousel: (direction: 'prev' | 'next') => void;
  setFrameHistoryIndex: (index: number) => void;

  // Active colourway (per-frame tracking)
  activeColourway: string;
  setActiveColourway: (id: string) => void;
  frameColourways: Record<string, string>;
  frameAiColourways: Record<string, string[]>;

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

  // Recommended frame size from face scan (e.g. 'standard' or 'large')
  recommendedSize: string | null;
  setRecommendedSize: (size: string | null) => void;

  // Camera brightness — true when the camera background is light enough
  // that white text should switch to dark for readability
  isCameraLight: boolean;
  setIsCameraLight: (v: boolean) => void;
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
      // Also ensure the new product is in the frame history and update the index
      const history = [...get().frameHistory];
      let idx = history.indexOf(activeProductId);
      if (idx === -1) {
        history.push(activeProductId);
        idx = history.length - 1;
      }
      set({
        activeProductId,
        previousProductId: current,
        frameHistory: history,
        frameHistoryIndex: idx,
      });
    }
  },

  scannedProductId: null,
  setScannedProductId: (scannedProductId) => set({ scannedProductId }),

  // Frame carousel
  frameHistory: [DEFAULT_PRODUCT_ID],
  frameHistoryIndex: 0,
  addFrameToHistory: (id) => {
    const history = get().frameHistory;
    if (!history.includes(id)) {
      set({ frameHistory: [...history, id] });
    }
  },
  navigateCarousel: (direction) => {
    const { frameHistory, frameHistoryIndex } = get();
    const newIndex =
      direction === 'prev'
        ? Math.max(0, frameHistoryIndex - 1)
        : Math.min(frameHistory.length - 1, frameHistoryIndex + 1);
    if (newIndex !== frameHistoryIndex) {
      const newProductId = frameHistory[newIndex];
      set({
        frameHistoryIndex: newIndex,
        activeProductId: newProductId,
        previousProductId: get().activeProductId,
      });
    }
  },
  setFrameHistoryIndex: (index) => {
    const { frameHistory } = get();
    if (index >= 0 && index < frameHistory.length) {
      set({
        frameHistoryIndex: index,
        activeProductId: frameHistory[index],
        previousProductId: get().activeProductId,
      });
    }
  },

  // Active colourway — also persisted per frame so swipes restore each frame's selection
  activeColourway: 'shiny-black',
  frameColourways: { [DEFAULT_PRODUCT_ID]: 'shiny-black' },
  frameAiColourways: {},
  setActiveColourway: (activeColourway) => {
    const pid = get().activeProductId;
    set({
      activeColourway,
      frameColourways: { ...get().frameColourways, [pid]: activeColourway },
    });
  },

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

  // Recommended size from face scan (defaults to 'standard' as a safe guess)
  recommendedSize: 'standard',
  setRecommendedSize: (recommendedSize) => set({ recommendedSize }),

  // Camera brightness
  isCameraLight: false,
  setIsCameraLight: (isCameraLight) => set({ isCameraLight }),

  // AI-recommended colourway — scoped to the current frame, accumulates all recommendations
  aiRecommendedColourway: null,
  setAiRecommendedColourway: (aiRecommendedColourway) => {
    const pid = get().activeProductId;
    const frameAiColourways = { ...get().frameAiColourways };
    if (aiRecommendedColourway) {
      const existing = frameAiColourways[pid] ?? [];
      if (!existing.includes(aiRecommendedColourway)) {
        frameAiColourways[pid] = [...existing, aiRecommendedColourway];
      }
    }
    set({ aiRecommendedColourway, frameAiColourways });
  },
}));

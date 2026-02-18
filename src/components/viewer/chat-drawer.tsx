'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring, PanInfo } from 'framer-motion';
import { useAppStore, ChatMessage } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';
import VoiceInput from '@/components/voice/voice-input';
import FrameThumbnail from './frame-thumbnail';

const COLLAPSED_H = 200;
const EXPANDED_TOP = 160;
const HANDLE_H = 36;

function useVisualViewport() {
  const [vp, setVp] = useState(() => {
    if (typeof window === 'undefined') return { height: 800, offsetTop: 0 };
    return {
      height: window.visualViewport?.height ?? window.innerHeight,
      offsetTop: window.visualViewport?.offsetTop ?? 0,
    };
  });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setVp({ height: vv.height, offsetTop: vv.offsetTop });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return vp;
}

function FrameCard({ message }: { message: ChatMessage }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setRequestingFrames = useAppStore((s) => s.setRequestingFrames);
  const savedFrames = useAppStore((s) => s.savedFrames);
  const addSavedFrame = useAppStore((s) => s.addSavedFrame);
  const removeSavedFrame = useAppStore((s) => s.removeSavedFrame);

  if (!message.frameId) return null;

  let product;
  try {
    product = getProduct(message.frameId);
  } catch {
    return null;
  }

  const isSaved = savedFrames.includes(message.frameId);
  const displayColourway = message.colourwayId
    ? (product.colourways.find((c) => c.id === message.colourwayId) ?? getColourway(message.colourwayId) ?? product.colourways[0])
    : product.colourways[0];

  const handleEye = () => {
    setRequestingFrames([{ frameId: message.frameId!, colourwayId: message.colourwayId }]);
    setScreen('request-frame');
  };

  const handleBookmark = () => {
    if (isSaved) removeSavedFrame(message.frameId!);
    else addSavedFrame(message.frameId!);
  };

  return (
    <div className="flex items-start gap-3 mt-3">
      <div
        className="w-[164px] h-[153px] rounded-[20px] border border-white/10 flex-shrink-0 overflow-hidden relative"
        style={{ backgroundColor: '#111618' }}
      >
        <FrameThumbnail
          productId={message.frameId!}
          colourwayId={message.colourwayId}
          className="!absolute inset-0 w-full h-full"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
          <p className="text-white/90 text-xs font-medium leading-tight">
            {product.name}
          </p>
          {displayColourway && (
            <p className="text-white/50 text-[10px] mt-0.5">{displayColourway.name}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <button
          onClick={handleEye}
          className="w-[33px] h-[33px] rounded-full border border-white/20 flex items-center justify-center text-foreground/50 hover:text-foreground/80 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <button
          onClick={handleBookmark}
          className={`w-[33px] h-[33px] rounded-full border flex items-center justify-center transition-colors ${
            isSaved
              ? 'border-white/40 text-foreground bg-white/10'
              : 'border-white/20 text-foreground/50 hover:text-foreground/80'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ChatDrawer() {
  const assistantMessage = useAppStore((s) => s.assistantMessage);
  const chatHistory = useAppStore((s) => s.chatHistory);
  const setScreen = useAppStore((s) => s.setScreen);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [bottomBarHeight, setBottomBarHeight] = useState(100);
  const [inputFocused, setInputFocused] = useState(false);
  const vp = useVisualViewport();

  const getMaxDrag = useCallback(() => {
    if (typeof window === 'undefined') return 500;
    return window.innerHeight - EXPANDED_TOP - COLLAPSED_H;
  }, []);

  const rawY = useMotionValue(0);
  const springY = useSpring(rawY, { stiffness: 300, damping: 30 });

  const translateY = useTransform(springY, (latest) => {
    const maxDrag = getMaxDrag();
    return maxDrag + Math.max(-maxDrag, Math.min(0, latest));
  });

  const [drawerHeight, setDrawerHeight] = useState(COLLAPSED_H + 500);
  useEffect(() => {
    setDrawerHeight(window.innerHeight - EXPANDED_TOP);
  }, []);

  useEffect(() => {
    const measure = () => {
      if (bottomRef.current) setBottomBarHeight(bottomRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory.length, expanded]);

  // Track input focus so we can adjust layout when keyboard is open
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') {
        setInputFocused(true);
        // Prevent iOS from scrolling the page to reveal the input —
        // we handle positioning via visualViewport instead.
        requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        });
      }
    };
    const onBlur = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') {
        setInputFocused(false);
        window.scrollTo(0, 0);
      }
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  // Keep the page pinned to top while keyboard is open
  useEffect(() => {
    if (!inputFocused) return;
    const pin = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('scroll', pin);
      vv.addEventListener('resize', pin);
    }
    window.addEventListener('scroll', pin);
    return () => {
      if (vv) {
        vv.removeEventListener('scroll', pin);
        vv.removeEventListener('resize', pin);
      }
      window.removeEventListener('scroll', pin);
    };
  }, [inputFocused]);

  // When keyboard opens on iOS, push the bottom bar up so it stays visible.
  // Also account for visualViewport.offsetTop which changes when iOS scrolls.
  const keyboardOffset = inputFocused
    ? Math.max(0, window.innerHeight - vp.height - vp.offsetTop)
    : 0;

  const handlePan = useCallback(
    (_: unknown, info: PanInfo) => {
      const maxDrag = getMaxDrag();
      const newY = Math.max(-maxDrag, Math.min(0, rawY.get() + info.delta.y));
      rawY.set(newY);
    },
    [rawY, getMaxDrag],
  );

  const handlePanEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const maxDrag = getMaxDrag();
      const currentY = rawY.get();
      const velocity = info.velocity.y;

      if (velocity < -300 || currentY < -maxDrag * 0.3) {
        rawY.set(-maxDrag);
        setExpanded(true);
      } else {
        rawY.set(0);
        setExpanded(false);
      }
    },
    [rawY, getMaxDrag],
  );

  const toggleDrawer = useCallback(() => {
    const maxDrag = getMaxDrag();
    if (expanded) {
      rawY.set(0);
      setExpanded(false);
    } else {
      rawY.set(-maxDrag);
      setExpanded(true);
    }
  }, [expanded, rawY, getMaxDrag]);

  const hasHistory = chatHistory.some((m) => m.role === 'assistant');

  // Derive the last assistant message from chat history so collapsed and
  // expanded views always show identical text — no truncation, no mismatch.
  const lastAssistantMsg = [...chatHistory].reverse().find((m) => m.role === 'assistant');
  const displayMessage = lastAssistantMsg?.content ?? assistantMessage ?? '';

  return (
    <>
      {/* Draggable panel — slides up/down, contains handle + chat content */}
      <motion.div
        className="absolute left-0 right-0 z-40 rounded-t-[40px]"
        style={{
          bottom: keyboardOffset,
          height: drawerHeight,
          y: translateY,
          willChange: 'transform',
          transition: 'bottom 100ms ease-out',
        }}
      >
        <div className="h-full relative bg-[#0e0e10] rounded-t-[40px] overflow-hidden">
          {/* Drag handle */}
          <motion.div
            className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none bg-[#0e0e10] rounded-t-[40px]"
            onPan={handlePan}
            onPanEnd={handlePanEnd}
            onDoubleClick={toggleDrawer}
          >
            <div className="w-[70px] h-[4px] rounded-full bg-foreground/20" />
          </motion.div>

          {/* Scrollable chat content */}
          <div
            ref={scrollRef}
            className="absolute left-0 right-0 overflow-y-auto px-6"
            style={{
              top: HANDLE_H,
              bottom: 0,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorY: 'contain',
              touchAction: expanded ? 'pan-y' : 'none',
            }}
          >
            {expanded && hasHistory ? (
              <div className="space-y-6 pt-2" style={{ paddingBottom: bottomBarHeight + 16 }}>
                {chatHistory.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'assistant' ? (
                      <div>
                        <p className="text-foreground/70 text-sm leading-relaxed text-center">
                          {msg.content}
                        </p>
                        {msg.frameId && <FrameCard message={msg} />}
                      </div>
                    ) : (
                      <p className="text-foreground/40 text-xs text-right italic">
                        {msg.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : expanded && !hasHistory ? (
              <p className="text-foreground/30 text-sm text-center pt-8">
                Start a conversation to see your chat history here.
              </p>
            ) : (
              displayMessage && (
                <p className="text-foreground/70 text-sm leading-relaxed text-center" style={{ paddingBottom: bottomBarHeight + 8 }}>
                  {displayMessage}
                </p>
              )
            )}
          </div>
        </div>
      </motion.div>

      {/* Static bottom bar — fixed to screen, positioned via visualViewport */}
      <div
        ref={bottomRef}
        className="fixed left-0 right-0 z-50 px-6 pt-3 bg-[#0e0e10]"
        style={{
          bottom: keyboardOffset,
          paddingBottom: keyboardOffset > 0
            ? '0.5rem'
            : 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)',
          transition: 'bottom 80ms linear',
        }}
      >
        <div className="flex justify-between mb-2">
          <button
            onClick={() => setScreen('frames-overview')}
            className="text-[9px] tracking-[0.9px] uppercase text-foreground/60 hover:text-foreground/80 transition-colors"
          >
            See overview of frames
          </button>
          <button
            onClick={() => setScreen('notify-assistant')}
            className="text-[9px] tracking-[0.9px] uppercase text-foreground/60 hover:text-foreground/80 transition-colors"
          >
            Notify assistant
          </button>
        </div>

        <VoiceInput />
      </div>
    </>
  );
}

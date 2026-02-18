'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring, PanInfo } from 'framer-motion';
import { useAppStore, ChatMessage } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';
import VoiceInput from '@/components/voice/voice-input';
import FrameThumbnail from './frame-thumbnail';

const COLLAPSED_H = 200;
const EXPANDED_TOP = 160;

function truncateMessage(text: string, maxLen = 140): string {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.'),
  );
  if (lastEnd > maxLen * 0.35) return truncated.slice(0, lastEnd + 1).trim();
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim() + '…';
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

  const rawY = useMotionValue(0);
  const y = useSpring(rawY, { stiffness: 300, damping: 30 });

  const getMaxDrag = useCallback(() => {
    if (typeof window === 'undefined') return 500;
    return window.innerHeight - EXPANDED_TOP - COLLAPSED_H;
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      setBottomBarHeight(bottomRef.current.offsetHeight);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory.length]);

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

  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-40 rounded-t-[40px]"
      style={{
        height: useTransform(y, (latest) => {
          const maxDrag = getMaxDrag();
          return COLLAPSED_H + Math.abs(Math.min(0, Math.max(-maxDrag, latest)));
        }),
        willChange: 'height',
      }}
    >
      <div className="h-full relative bg-[#111618] rounded-t-[40px] shadow-[0px_-4px_20px_0px_rgba(255,255,255,0.1)] overflow-hidden">
        {/* Drag handle — pinned top */}
        <motion.div
          className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none bg-[#111618] rounded-t-[40px]"
          onPan={handlePan}
          onPanEnd={handlePanEnd}
          onDoubleClick={toggleDrawer}
        >
          <div className="w-[70px] h-[4px] rounded-full bg-foreground/20" />
        </motion.div>

        {/* Scrollable chat history — absolute between handle and bottom bar */}
        <div
          ref={scrollRef}
          className="absolute left-0 right-0 overflow-y-auto px-6"
          style={{
            top: 36,
            bottom: bottomBarHeight,
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            touchAction: 'pan-y',
          }}
        >
          {!expanded && assistantMessage && (
            <p className="text-foreground/70 text-sm leading-relaxed text-center">
              {truncateMessage(assistantMessage)}
            </p>
          )}

          {expanded && hasHistory && (
            <div className="space-y-6 pt-2 pb-4">
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
          )}

          {expanded && !hasHistory && (
            <p className="text-foreground/30 text-sm text-center pt-8">
              Start a conversation to see your chat history here.
            </p>
          )}
        </div>

        {/* Bottom pinned — always visible */}
        <div
          ref={bottomRef}
          className="absolute bottom-0 left-0 right-0 z-10 px-6 pt-3 bg-[#111618]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          <div className="flex justify-start mb-2">
            <button
              onClick={() => setScreen('frames-overview')}
              className="text-[9px] tracking-[0.9px] uppercase text-foreground/60 hover:text-foreground/80 transition-colors"
            >
              See overview of frames
            </button>
          </div>

          <VoiceInput />
        </div>
      </div>
    </motion.div>
  );
}

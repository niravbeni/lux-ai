'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { triggerHaptic } from '@/lib/haptics';

const pills = [
  {
    id: 'colour',
    label: 'Colour match',
    screen: 'colour-mode' as const,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    id: 'fit',
    label: 'Fit & sizing',
    screen: 'fit-mode' as const,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    id: 'details',
    label: 'More details',
    screen: 'details-mode' as const,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
];

export default function SuggestionPills() {
  const setScreen = useAppStore((s) => s.setScreen);
  const isCameraLight = useAppStore((s) => s.isCameraLight);

  const handlePillClick = (screen: typeof pills[number]['screen']) => {
    triggerHaptic('light');
    setScreen(screen);
  };

  return (
    <motion.div
      className="flex flex-wrap justify-center gap-2 px-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      {pills.map((pill, i) => (
        <motion.button
          key={pill.id}
          onClick={() => handlePillClick(pill.screen)}
          className="group relative overflow-hidden flex items-center gap-2 rounded-full px-4 py-2.5 text-xs sm:px-5 whitespace-nowrap transition-all duration-300 active:scale-95 text-gold hover:text-gold-light"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
        >
          {/* Hover fill */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Border */}
          <div className="absolute inset-0 rounded-full border border-gold/50 group-hover:border-gold/70 transition-colors duration-300" />
          <span className="relative text-gold group-hover:text-gold-light transition-colors duration-300">{pill.icon}</span>
          <span className="relative">{pill.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

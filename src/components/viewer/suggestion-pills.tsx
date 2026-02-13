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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
];

export default function SuggestionPills() {
  const setScreen = useAppStore((s) => s.setScreen);

  const handlePillClick = (screen: typeof pills[number]['screen']) => {
    triggerHaptic('light');
    setScreen(screen);
  };

  return (
    <motion.div
      className="flex flex-nowrap justify-center gap-2 px-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      {pills.map((pill, i) => (
        <motion.button
          key={pill.id}
          onClick={() => handlePillClick(pill.screen)}
          className="glass-card flex items-center gap-1.5 rounded-full px-3 py-2 text-foreground/70 text-xs whitespace-nowrap transition-all duration-200 hover:text-foreground hover:border-gold/30 active:scale-95"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
        >
          <span className="text-gold/70">{pill.icon}</span>
          {pill.label}
        </motion.button>
      ))}
    </motion.div>
  );
}

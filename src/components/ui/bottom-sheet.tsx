'use client';

import { motion } from 'framer-motion';

interface BottomSheetProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}

export default function BottomSheet({ children, onClose, title }: BottomSheetProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-h-[85vh] bg-[#111111] rounded-t-3xl overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-6 pb-4 border-b border-foreground/5">
            <h2 className="text-foreground/80 text-base font-medium">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] px-6 py-5 space-y-5" style={{ scrollbarWidth: 'none' }}>
          {children}
        </div>

        {/* Safe area */}
        <div className="safe-bottom" />
      </motion.div>
    </motion.div>
  );
}

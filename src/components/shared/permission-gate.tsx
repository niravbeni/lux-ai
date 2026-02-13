'use client';

import { useState, useEffect, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PermissionGateProps {
  permission: 'camera' | 'microphone';
  children: ReactNode;
  fallback?: ReactNode;
  onGranted?: () => void;
  onDenied?: () => void;
}

export default function PermissionGate({
  permission,
  children,
  fallback,
  onGranted,
  onDenied,
}: PermissionGateProps) {
  const [status, setStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');

  useEffect(() => {
    async function checkPermission() {
      try {
        const permName = permission === 'camera' ? 'camera' : 'microphone';
        const result = await navigator.permissions.query({ name: permName as PermissionName });
        setStatus(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'prompt');

        result.addEventListener('change', () => {
          setStatus(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'prompt');
        });
      } catch {
        // Permissions API not supported — assume prompt
        setStatus('prompt');
      }
    }

    checkPermission();
  }, [permission]);

  useEffect(() => {
    if (status === 'granted') onGranted?.();
    if (status === 'denied') onDenied?.();
  }, [status, onGranted, onDenied]);

  if (status === 'denied' && fallback) {
    return <>{fallback}</>;
  }

  if (status === 'denied') {
    return (
      <motion.div
        className="flex h-full w-full items-center justify-center p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="glass-card rounded-2xl p-6 text-center max-w-sm">
          <p className="text-foreground/70 text-sm mb-2">
            {permission === 'camera'
              ? 'Camera access is needed for this feature.'
              : 'Microphone access is needed for voice input.'}
          </p>
          <p className="text-foreground/40 text-xs">
            Please enable {permission} access in your browser settings and try again.
          </p>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}

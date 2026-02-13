export function triggerHaptic(pattern: 'light' | 'medium' | 'success' = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  switch (pattern) {
    case 'light':
      navigator.vibrate(10);
      break;
    case 'medium':
      navigator.vibrate(25);
      break;
    case 'success':
      navigator.vibrate([15, 50, 30]);
      break;
  }
}

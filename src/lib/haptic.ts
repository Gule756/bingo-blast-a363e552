// Telegram WebApp Haptic Feedback helpers
// Falls back to no-op when not in Telegram environment

function getTelegram() {
  return (window as any)?.Telegram?.WebApp;
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
  try {
    getTelegram()?.HapticFeedback?.impactOccurred(style);
  } catch {}
}

export function hapticNotification(type: 'error' | 'success' | 'warning' = 'success') {
  try {
    getTelegram()?.HapticFeedback?.notificationOccurred(type);
  } catch {}
}

export function hapticSelection() {
  try {
    getTelegram()?.HapticFeedback?.selectionChanged();
  } catch {}
}

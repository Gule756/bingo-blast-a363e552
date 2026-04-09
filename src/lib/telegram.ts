// Telegram Mini App utilities

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  const tg = getTelegramWebApp();
  return !!tg && !!tg.initData && tg.initData.length > 0;
}

export function getTelegramUser(): TelegramWebAppUser | null {
  const tg = getTelegramWebApp();
  return tg?.initDataUnsafe?.user ?? null;
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

export function requestTelegramContact(): Promise<{
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id: number;
} | null> {
  return new Promise((resolve) => {
    const tg = getTelegramWebApp();
    if (!tg || !tg.requestContact) {
      resolve(null);
      return;
    }

    tg.requestContact((sent, event) => {
      if (sent && event?.responseUnsafe?.contact) {
        resolve(event.responseUnsafe.contact);
      } else {
        resolve(null);
      }
    });
  });
}

export function expandTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
  }
}

export function telegramHaptic(type: 'impact' | 'notification' | 'selection', value?: string) {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;
  
  if (type === 'impact') {
    tg.HapticFeedback.impactOccurred((value as 'light' | 'medium' | 'heavy') || 'medium');
  } else if (type === 'notification') {
    tg.HapticFeedback.notificationOccurred((value as 'success' | 'error' | 'warning') || 'success');
  } else {
    tg.HapticFeedback.selectionChanged();
  }
}

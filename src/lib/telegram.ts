// Telegram Mini App utilities

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

// Type assertion for extended properties
type ExtendedTelegramWebApp = TelegramWebApp & {
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  sendData?: (data: string) => void;
};

export function getExtendedTelegramWebApp(): ExtendedTelegramWebApp | null {
  return window.Telegram?.WebApp as ExtendedTelegramWebApp ?? null;
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

// Deep linking utilities
export function getStartParam(): string | null {
  const tg = getExtendedTelegramWebApp();
  return tg?.initDataUnsafe?.start_param ?? null;
}

export function parseStartParam(startParam: string): { action?: string; userId?: string; ref?: string; [key: string]: string } {
  const params = new URLSearchParams(startParam);
  const result: Record<string, string> = {};
  
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  
  return result;
}

export function getMiniAppAction(): { action: string; params: Record<string, string> } {
  const startParam = getStartParam();
  
  if (!startParam) {
    return { action: 'welcome', params: {} };
  }
  
  const parsed = parseStartParam(startParam);
  const action = parsed.action || 'welcome';
  
  return { action, params: parsed };
}

// Command execution from Mini App
export function executeBotCommand(command: string, args?: Record<string, string>) {
  const tg = getExtendedTelegramWebApp();
  if (!tg?.sendData) return false;
  
  // Send data back to bot via iframe message
  const data = {
    type: 'bot_command',
    command,
    args: args || {}
  };
  
  tg.sendData(JSON.stringify(data));
  return true;
}

// Mini App navigation
export function navigateToAction(action: string, params?: Record<string, string>) {
  const tg = getTelegramWebApp();
  if (!tg) return;
  
  const queryString = new URLSearchParams({
    action,
    ...params
  }).toString();
  
  // Update the current URL without reload
  const newUrl = `${window.location.pathname}?${queryString}`;
  window.history.pushState({}, '', newUrl);
}

// Get current action from URL
export function getCurrentAction(): { action: string; params: Record<string, string> } {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action') || 'welcome';
  const params: Record<string, string> = {};
  
  for (const [key, value] of urlParams.entries()) {
    if (key !== 'action') {
      params[key] = value;
    }
  }
  
  return { action, params };
}

// Telegram Bot API integration for Mini App
export interface TelegramBotCommand {
  command: string;
  description: string;
}

export function getBotCommands(): TelegramBotCommand[] {
  return [
    { command: 'start', description: 'Start or return to main menu' },
    { command: 'register', description: 'Create your account' },
    { command: 'play', description: 'Start a new game' },
    { command: 'balance', description: 'Check your balance and transactions' },
    { command: 'deposit', description: 'Add funds to your account' },
    { command: 'withdraw', description: 'Withdraw your winnings' },
    { command: 'transfer', description: 'Send funds to other players' },
    { command: 'invite', description: 'Invite friends and earn bonuses' },
    { command: 'instructions', description: 'How to play' },
    { command: 'cancel', description: 'Cancel current action' },
    { command: 'help', description: 'Show help message' }
  ];
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { hapticImpact } from '@/lib/haptic';
import { 
  isTelegramMiniApp, 
  getTelegramInitData, 
  getTelegramUser, 
  requestTelegramContact, 
  expandTelegramApp,
  getMiniAppAction,
  getCurrentAction,
  navigateToAction,
  executeBotCommand
} from '@/lib/telegram';
import { supabase } from '@/integrations/supabase/client';

interface WelcomeScreenProps {
  onAuthenticate: (name: string, phone: string, playerId?: string, balance?: number, totalWins?: number) => void;
}

type Step = 'loading' | 'intro' | 'contact' | 'verifying' | 'done' | 'error';

export function WelcomeScreen({ onAuthenticate }: WelcomeScreenProps) {
  const [step, setStep] = useState<Step>('loading');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);
  const [botAction, setBotAction] = useState<{ action: string; params: Record<string, string> } | null>(null);

  // Auto-detect Telegram Mini App on mount and handle deep linking
  useEffect(() => {
    const inTelegram = isTelegramMiniApp();
    setIsTelegram(inTelegram);

    if (inTelegram) {
      expandTelegramApp();
      
      // Check for bot command actions
      const currentAction = getCurrentAction();
      const miniAppAction = getMiniAppAction();
      
      // Use URL action first, then fall back to start_param
      const action = currentAction.action !== 'welcome' ? currentAction : miniAppAction;
      
      if (action.action !== 'welcome') {
        setBotAction(action);
        console.log('Bot action detected:', action);
      }
      
      autoAuthViaTelegram();
    } else {
      setStep('intro');
    }
  }, []);

  // Auto-authenticate via Telegram WebApp initData
  async function autoAuthViaTelegram() {
    try {
      const initData = getTelegramInitData();
      const tgUser = getTelegramUser();

      if (!initData || !tgUser) {
        setStep('intro');
        return;
      }

      setStep('verifying');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/telegram-auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Authentication failed');
        setStep('error');
        return;
      }

      const player = data.player;

      if (player.isVerified) {
        // Already verified, go straight in
        setStep('done');
        setTimeout(() => {
          onAuthenticate(player.name, player.phone || '', player.id, player.balance, player.totalWins);
        }, 800);
      } else {
        // Need contact verification
        setName(player.name);
        setStep('contact');
      }
    } catch (err) {
      console.error('Telegram auth error:', err);
      setError('Connection failed. Please try again.');
      setStep('error');
    }
  }

  // Handle Telegram contact sharing
  async function handleTelegramContact() {
    hapticImpact('medium');
    
    try {
      const contact = await requestTelegramContact();
      
      if (!contact) {
        setError('Contact sharing was cancelled. Please try again.');
        return;
      }

      setStep('verifying');

      const initData = getTelegramInitData();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/telegram-auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, contact }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Verification failed');
        setStep('contact');
        return;
      }

      const player = data.player;
      setStep('done');
      setTimeout(() => {
        onAuthenticate(player.name, player.phone || '', player.id, player.balance, player.totalWins);
        
        // Handle bot action after authentication
        if (botAction) {
          handleBotActionAfterAuth(botAction);
        }
      }, 800);
    } catch (err) {
      console.error('Contact verification error:', err);
      setError('Verification failed. Please try again.');
      setStep('contact');
    }
  }

  // Handle bot actions after authentication completes
  function handleBotActionAfterAuth(action: { action: string; params: Record<string, string> }) {
    console.log('Processing bot action:', action);
    
    switch (action.action) {
      case 'play':
        // Navigate to play screen after a short delay
        setTimeout(() => {
          navigateToAction('play', action.params);
        }, 1000);
        break;
        
      case 'balance':
        setTimeout(() => {
          navigateToAction('balance', action.params);
        }, 1000);
        break;
        
      case 'deposit':
        setTimeout(() => {
          navigateToAction('deposit', action.params);
        }, 1000);
        break;
        
      case 'withdraw':
        setTimeout(() => {
          navigateToAction('withdraw', action.params);
        }, 1000);
        break;
        
      case 'transfer':
        setTimeout(() => {
          navigateToAction('transfer', action.params);
        }, 1000);
        break;
        
      case 'invite':
        setTimeout(() => {
          navigateToAction('invite', action.params);
        }, 1000);
        break;
        
      case 'instructions':
        setTimeout(() => {
          navigateToAction('instructions', action.params);
        }, 1000);
        break;
        
      default:
        console.log('Unknown bot action:', action.action);
        break;
    }
  }
  
  function handleShareContact() {
    hapticImpact('medium');
    if (isTelegram) {
      handleTelegramContact();
    } else {
      setStep('contact');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border-4 border-bingo-g bg-card">
          <span className="font-mono text-4xl font-black tracking-tighter text-foreground">HB</span>
        </div>
        <h1 className="mb-2 text-3xl font-black tracking-tight text-foreground">Habesha Bingo</h1>
        <p className="text-muted-foreground">
          {isTelegram ? 'Telegram Mini App' : 'Multiplayer Bingo via Telegram'}
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-xs space-y-4"
      >
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-muted-foreground">Connecting...</p>
          </div>
        )}

        {step === 'intro' && (
          <>
            <button
              onClick={handleShareContact}
              className="gradient-hero w-full rounded-xl px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              📱 {isTelegram ? 'Share Contact to Verify' : 'Share Contact to Verify'}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Share your contact to prevent spam and verify identity
            </p>
          </>
        )}

        {step === 'contact' && (
          <div className="space-y-3">
            {isTelegram ? (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Welcome, <span className="font-bold text-foreground">{name}</span>! Share your contact to complete verification.
                </p>
                {error && <p className="text-xs font-semibold text-destructive text-center">{error}</p>}
                <button
                  onClick={handleTelegramContact}
                  className="gradient-hero w-full rounded-xl px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                  <span className="text-lg">{"\ud83d\udcf1"} Share Contact</span>
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Telegram will ask for permission to share your phone number
                </p>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="text-4xl">{"\ud83d\udcf1"}</div>
                <p className="text-sm font-semibold text-foreground">
                  Telegram Required for Verification
                </p>
                <p className="text-xs text-muted-foreground">
                  This game uses Telegram's secure contact sharing for verification. 
                  Please open this app in Telegram to continue.
                </p>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground mb-2">How to play:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 text-left">
                    <li>1. Find our bot in Telegram</li>
                    <li>2. Start the game from the bot</li>
                    <li>3. Share your contact to verify</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'verifying' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-muted-foreground">
              {isTelegram ? 'Verifying via Telegram...' : 'Verifying...'}
            </p>
          </div>
        )}

        {step === 'done' && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
            <div className="mb-2 text-4xl">✅</div>
            <p className="text-sm font-semibold text-accent">Verified! Entering lobby...</p>
          </motion.div>
        )}

        {step === 'error' && (
          <div className="space-y-3 text-center">
            <div className="text-4xl">❌</div>
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <button
              onClick={() => {
                setError('');
                if (isTelegram) {
                  autoAuthViaTelegram();
                } else {
                  setStep('intro');
                }
              }}
              className="w-full rounded-xl border border-border px-6 py-3 text-sm font-bold text-foreground transition-transform active:scale-95"
            >
              🔄 Try Again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

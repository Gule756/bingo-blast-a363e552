import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { hapticImpact } from '@/lib/haptic';
import { isTelegramMiniApp, getTelegramInitData, getTelegramUser, requestTelegramContact, expandTelegramApp } from '@/lib/telegram';
import { supabase } from '@/integrations/supabase/client';

interface WelcomeScreenProps {
  onAuthenticate: (name: string, phone: string, playerId?: string, balance?: number, totalWins?: number) => void;
}

type Step = 'loading' | 'intro' | 'contact' | 'verifying' | 'done' | 'error';

export function WelcomeScreen({ onAuthenticate }: WelcomeScreenProps) {
  const [step, setStep] = useState<Step>('loading');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isTelegram, setIsTelegram] = useState(false);

  // Auto-detect Telegram Mini App on mount
  useEffect(() => {
    const inTelegram = isTelegramMiniApp();
    setIsTelegram(inTelegram);

    if (inTelegram) {
      expandTelegramApp();
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
      }, 800);
    } catch (err) {
      console.error('Contact verification error:', err);
      setError('Verification failed. Please try again.');
      setStep('contact');
    }
  }

  // Browser fallback: manual contact entry
  function handleManualSubmit() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }
    if (!trimmedPhone || !/^\+?[0-9]{9,15}$/.test(trimmedPhone)) {
      setError('Please enter a valid phone number');
      return;
    }

    setError('');
    setStep('verifying');
    setTimeout(() => {
      setStep('done');
      setTimeout(() => onAuthenticate(trimmedName, trimmedPhone), 800);
    }, 1500);
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
                  📱 Share Contact
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Telegram will ask for permission to share your phone number
                </p>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Tesfa"
                    maxLength={30}
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. +251912345678"
                    maxLength={15}
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
                <button
                  onClick={handleManualSubmit}
                  className="gradient-hero w-full rounded-xl px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                  🎯 Verify & Enter
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Your contact is stored securely to prevent abuse
                </p>
              </>
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

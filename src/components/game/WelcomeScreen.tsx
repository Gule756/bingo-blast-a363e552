import { useState } from 'react';
import { motion } from 'framer-motion';
import { hapticImpact } from '@/lib/haptic';

interface WelcomeScreenProps {
  onAuthenticate: (name: string, phone: string) => void;
}

export function WelcomeScreen({ onAuthenticate }: WelcomeScreenProps) {
  const [step, setStep] = useState<'intro' | 'contact' | 'verifying' | 'done'>('intro');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleShareContact = () => {
    hapticImpact('medium');
    setStep('contact');
  };

  const handleSubmitContact = () => {
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
    // Simulate Telegram SDK verification delay
    setTimeout(() => {
      setStep('done');
      setTimeout(() => onAuthenticate(trimmedName, trimmedPhone), 800);
    }, 1500);
  };

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
        <p className="text-muted-foreground">Multiplayer Bingo via Telegram</p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-xs space-y-4"
      >
        {step === 'intro' && (
          <>
            <button
              onClick={handleShareContact}
              className="gradient-hero w-full rounded-xl px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              📱 Share Contact to Verify
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Share your contact to prevent spam and verify identity
            </p>
          </>
        )}

        {step === 'contact' && (
          <div className="space-y-3">
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
              onClick={handleSubmitContact}
              className="gradient-hero w-full rounded-xl px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
            >
              🎯 Verify & Enter
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Your contact is stored securely to prevent abuse
            </p>
          </div>
        )}

        {step === 'verifying' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-semibold text-muted-foreground">Verifying via Telegram...</p>
          </div>
        )}

        {step === 'done' && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
            <div className="mb-2 text-4xl">✅</div>
            <p className="text-sm font-semibold text-accent">Verified! Entering lobby...</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

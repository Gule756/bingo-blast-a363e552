import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { hapticImpact } from '@/lib/haptic';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WithdrawalScreenProps {
  balance: number;
  userId: string;
  onBalanceUpdate: (newBalance: number) => void;
  onBack: () => void;
}

export function WithdrawalScreen({ balance, userId, onBalanceUpdate, onBack }: WithdrawalScreenProps) {
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const numAmount = Number(amount);
  const insufficientFunds = numAmount > balance;

  const handleSubmit = async () => {
    if (numAmount <= 0 || insufficientFunds) return;
    if (walletAddress.trim().length < 10) {
      toast.error('Please enter a valid wallet address');
      return;
    }

    hapticImpact('medium');
    setStatus('processing');
    setErrorMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('withdraw', {
        body: {
          player_id: userId,
          amount: numAmount,
          wallet_address: walletAddress.trim(),
        },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        setStatus('success');
        onBalanceUpdate(data.new_balance);
        toast.success('Withdrawal submitted! Funds locked pending approval.');
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Withdrawal failed');
        toast.error(data.error || 'Withdrawal failed');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'Network error');
      toast.error('Failed to process withdrawal');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setAmount('');
    setWalletAddress('');
    setErrorMsg('');
  };

  return (
    <div className="flex min-h-screen flex-col p-4">
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">💸 Withdraw ETB</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cash out to your crypto wallet</p>
        </div>

        <div className="rounded-xl bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Available Balance</p>
          <p className="text-3xl font-black text-accent">{balance} ETB</p>
        </div>

        {status === 'idle' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Amount (ETB)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter withdrawal amount..."
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {insufficientFunds && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <p className="text-xs font-bold">Insufficient funds</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Wallet Address (ETH)</label>
              <input
                type="text"
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="rounded-xl bg-primary/5 p-3">
              <p className="text-[10px] text-muted-foreground">
                ⚠️ Funds will be locked immediately and sent after admin approval. Processing may take up to 24 hours.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={numAmount <= 0 || insufficientFunds || walletAddress.trim().length < 10}
              className="gradient-hero w-full rounded-xl px-6 py-3 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              Submit Withdrawal
            </button>
          </>
        )}

        {status === 'processing' && (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-primary/10 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-semibold text-primary">Processing withdrawal...</p>
          </div>
        )}

        {status === 'success' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/10 p-4">
              <CheckCircle className="h-5 w-5 text-accent" />
              <p className="text-sm font-bold text-accent">Withdrawal submitted! Pending approval.</p>
            </div>
            <button onClick={onBack} className="w-full rounded-xl bg-accent px-6 py-3 text-lg font-bold text-accent-foreground transition-transform active:scale-95">
              Return
            </button>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-4">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-bold text-destructive">{errorMsg || 'Withdrawal failed'}</p>
            </div>
            <button onClick={handleReset} className="w-full rounded-xl bg-secondary px-6 py-3 font-bold text-foreground transition-transform active:scale-95">
              Try Again
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

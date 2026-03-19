import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { hapticImpact } from '@/lib/haptic';

interface DepositScreenProps {
  balance: number;
  status: 'idle' | 'verifying' | 'success' | 'error';
  onSubmit: (txHash: string) => void;
  onReset: () => void;
  onBack: () => void;
}

export function DepositScreen({ balance, status, onSubmit, onReset, onBack }: DepositScreenProps) {
  const [txHash, setTxHash] = useState('');

  const handleSubmit = () => {
    if (txHash.trim().length < 10) return;
    hapticImpact('medium');
    onSubmit(txHash.trim());
  };

  return (
    <div className="flex min-h-screen flex-col p-4">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Lobby
      </button>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">💰 Deposit ETB</h2>
          <p className="mt-1 text-sm text-muted-foreground">Submit your transaction hash to verify</p>
        </div>

        <div className="rounded-xl bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-black text-accent">{balance} ETB</p>
        </div>

        <div className="rounded-xl bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Wallet Address</p>
          <div className="rounded-lg bg-secondary p-3 font-mono text-xs text-foreground break-all select-all">
            EQDrjaLahLk...YourWallet123
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Transaction Hash (TxHash)</label>
          <input
            type="text"
            value={txHash}
            onChange={e => setTxHash(e.target.value)}
            placeholder="Enter your transaction hash..."
            disabled={status === 'verifying'}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {status === 'idle' && (
          <button
            onClick={handleSubmit}
            disabled={txHash.trim().length < 10}
            className="gradient-hero w-full rounded-xl px-6 py-3 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            Verify Deposit
          </button>
        )}

        {status === 'verifying' && (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-primary/10 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-semibold text-primary">Verifying transaction...</p>
          </div>
        )}

        {status === 'success' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/10 p-4">
              <CheckCircle className="h-5 w-5 text-accent" />
              <p className="text-sm font-bold text-accent">+50 ETB deposited successfully!</p>
            </div>
            <button
              onClick={onBack}
              className="w-full rounded-xl bg-accent px-6 py-3 text-lg font-bold text-accent-foreground transition-transform active:scale-95"
            >
              Return to Lobby
            </button>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/10 p-4">
              <XCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-bold text-destructive">Invalid transaction hash</p>
            </div>
            <button
              onClick={onReset}
              className="w-full rounded-xl bg-secondary px-6 py-3 font-bold text-foreground transition-transform active:scale-95"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

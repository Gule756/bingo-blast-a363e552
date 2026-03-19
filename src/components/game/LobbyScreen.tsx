import { motion } from 'framer-motion';
import { LobbyGrid } from './LobbyGrid';
import { MIN_BET } from '@/types/game';

interface LobbyScreenProps {
  timer: number;
  selectedStack: number | null;
  occupiedStacks: Set<number>;
  user: { balance: number; name: string };
  stats: { players: number; bet: number; callCount: number };
  canAffordBet: boolean;
  onSelect: (id: number) => void;
  onDeposit: () => void;
}

export function LobbyScreen({ timer, selectedStack, occupiedStacks, user, stats, canAffordBet, onSelect, onDeposit }: LobbyScreenProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-1 bg-card p-2">
        {[
          { label: 'CARD', value: selectedStack ?? '-' },
          { label: 'WALLET', value: `${user.balance} ETB` },
          { label: 'STAKE', value: `${stats.bet} ETB` },
          { label: 'STARTING', value: `${timer}s`, highlight: timer <= 10 },
        ].map(s => (
          <div key={s.label} className={`stat-card flex-1 ${s.highlight ? 'gradient-danger' : ''}`}>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <span className={`text-sm font-bold ${s.highlight ? 'text-primary-foreground' : 'text-foreground'}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Insufficient balance warning */}
      {!canAffordBet && (
        <div className="mx-2 mt-2 rounded-lg border-l-4 border-destructive bg-destructive/10 p-3">
          <p className="text-sm font-bold text-foreground">Insufficient balance!</p>
          <p className="text-xs text-muted-foreground">
            You need {MIN_BET} ETB to play. Your balance: {user.balance} ETB.
          </p>
          <button
            onClick={onDeposit}
            className="mt-2 rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground transition-transform active:scale-95"
          >
            💰 Deposit Now
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        <LobbyGrid selectedStack={selectedStack} occupiedStacks={occupiedStacks} onSelect={onSelect} />
      </div>
    </div>
  );
}

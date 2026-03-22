import { useState } from 'react';
import { GameState } from '@/types/game';
import { StatsBar } from './StatsBar';
import { NumberCaller } from './NumberCaller';
import { BingoBoard } from './BingoBoard';
import { SpectatorCard } from './SpectatorCard';
import { BoardSidebar } from './BoardSidebar';
import { hapticImpact } from '@/lib/haptic';

interface GameScreenProps {
  state: GameState;
  daubedCount: number;
  onDaub: (num: number) => void;
  onClaim: () => void;
  onClose: () => void;
}

export function GameScreen({ state, daubedCount, onDaub, onClaim, onClose }: GameScreenProps) {
  const bingoDisabled = daubedCount < 5 || state.isEliminated;
  const [activeCardIdx, setActiveCardIdx] = useState(0);

  const handleClaim = () => {
    hapticImpact('heavy');
    onClaim();
  };

  const hasCards = state.bingoCards.length > 0;
  const activeCard = hasCards ? state.bingoCards[Math.min(activeCardIdx, state.bingoCards.length - 1)] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <StatsBar stats={state.stats} balance={state.user.balance} onClose={onClose} />

      <div className="p-2 text-center text-sm font-semibold text-muted-foreground">
        {state.playerMode === 'eliminated' ? '❌ Eliminated — Watching' : 
         hasCards ? `Playing ${state.bingoCards.length} card${state.bingoCards.length > 1 ? 's' : ''}` : 'Started'}
      </div>

      {/* Card tabs for multi-card */}
      {hasCards && state.bingoCards.length > 1 && (
        <div className="flex gap-1 px-2 pb-1 overflow-x-auto">
          {state.bingoCards.map((card, idx) => (
            <button
              key={card.id}
              onClick={() => setActiveCardIdx(idx)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                idx === activeCardIdx
                  ? 'bg-accent text-accent-foreground shadow-md'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              Card #{card.id}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 gap-2 overflow-hidden px-2 pb-2">
        {/* Sidebar */}
        <div className="w-[38%] shrink-0 overflow-y-auto">
          <BoardSidebar calledNumbers={state.calledNumbers} />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <NumberCaller calledNumbers={state.calledNumbers} />

          {state.playerMode === 'spectator' ? (
            <SpectatorCard />
          ) : activeCard ? (
            <>
              <BingoBoard
                card={activeCard}
                daubedNumbers={state.daubedNumbers}
                isEliminated={state.isEliminated}
                onDaub={onDaub}
              />
              {!state.isEliminated && (
                <button
                  onClick={handleClaim}
                  disabled={bingoDisabled}
                  className="gradient-winner rounded-xl px-6 py-3 text-lg font-black text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:scale-100"
                >
                  🎯 BINGO! {daubedCount < 5 && `(${daubedCount}/5)`}
                </button>
              )}
              {state.isEliminated && (
                <div className="rounded-xl bg-destructive/20 p-3 text-center text-sm font-semibold text-destructive">
                  ❌ False claim! You've been eliminated. Watching as spectator...
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
  onClaim: (cardId: number) => void;
  onClose: () => void;
}

export function GameScreen({ state, daubedCount, onDaub, onClaim, onClose }: GameScreenProps) {
  const [activeCardIdx, setActiveCardIdx] = useState(0);

  const handleClaim = (cardId: number) => {
    hapticImpact('heavy');
    onClaim(cardId);
  };

  const hasCards = state.bingoCards.length > 0;
  const activeCard = hasCards ? state.bingoCards[Math.min(activeCardIdx, state.bingoCards.length - 1)] : null;
  const activeCardEliminated = activeCard ? (state.eliminatedCardIds.has(activeCard.id)) : false;
  const allEliminated = state.bingoCards.every(c => state.eliminatedCardIds.has(c.id));

  return (
    <div className="flex min-h-screen flex-col">
      <StatsBar stats={state.stats} balance={state.user.balance} onClose={onClose} />

      <div className="p-2 text-center text-sm font-semibold text-muted-foreground">
        {allEliminated ? '❌ All cards eliminated — Watching' :
         state.playerMode === 'spectator' ? '👁️ Spectator Mode' :
         hasCards ? `Playing ${state.bingoCards.length} card${state.bingoCards.length > 1 ? 's' : ''}` : 'Started'}
      </div>

      {/* Card tabs for multi-card */}
      {hasCards && state.bingoCards.length > 1 && (
        <div className="flex gap-1 px-2 pb-1 overflow-x-auto">
          {state.bingoCards.map((card, idx) => {
            const isCardEliminated = state.eliminatedCardIds.has(card.id);
            return (
              <button
                key={card.id}
                onClick={() => setActiveCardIdx(idx)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  isCardEliminated
                    ? 'bg-destructive/20 text-destructive line-through'
                    : idx === activeCardIdx
                      ? 'bg-accent text-accent-foreground shadow-md'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                Card #{card.id} {isCardEliminated ? '❌' : ''}
              </button>
            );
          })}
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
                isEliminated={activeCardEliminated}
                onDaub={onDaub}
              />
              {!activeCardEliminated && !allEliminated && (
                <button
                  onClick={() => handleClaim(activeCard.id)}
                  disabled={daubedCount < 5}
                  className="gradient-winner rounded-xl px-6 py-3 text-lg font-black text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:scale-100"
                >
                  🎯 BINGO! {daubedCount < 5 && `(${daubedCount}/5)`}
                </button>
              )}
              {activeCardEliminated && (
                <div className="rounded-xl bg-destructive/20 p-3 text-center text-sm font-semibold text-accent">
                  ❌ This card was eliminated. {!allEliminated ? 'Switch to another card!' : 'Watching as spectator...'}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

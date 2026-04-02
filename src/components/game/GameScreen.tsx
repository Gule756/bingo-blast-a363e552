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
  const cardCount = state.bingoCards.length;
  const allEliminated = state.bingoCards.every(c => state.eliminatedCardIds.has(c.id));

  const handleClaim = (cardId: number) => {
    hapticImpact('heavy');
    onClaim(cardId);
  };

  const hasCards = state.bingoCards.length > 0;
  const statusText = allEliminated ? '❌ All cards eliminated — Watching' :
    state.playerMode === 'spectator' ? '👁️ Spectator Mode' :
    hasCards ? `Playing ${cardCount} card${cardCount > 1 ? 's' : ''}` : 'Started';

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <StatsBar stats={state.stats} balance={state.user.balance} onClose={onClose} />

      <div className="py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
        {statusText}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-2 gap-2">
        {/* TOP HUD: sidebar + caller */}
        <div className={`grid gap-2 shrink-0 ${cardCount === 1 ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_120px]'}`}
          style={cardCount > 1 ? { height: '25%' } : undefined}
        >
          {cardCount === 1 ? (
            <>
              <BoardSidebar calledNumbers={state.calledNumbers} />
              <div className="flex flex-col justify-center">
                <NumberCaller calledNumbers={state.calledNumbers} />
              </div>
            </>
          ) : (
            <>
              <BoardSidebar calledNumbers={state.calledNumbers} compact horizontal />
              <div className="flex flex-col justify-center">
                <NumberCaller calledNumbers={state.calledNumbers} compact />
              </div>
            </>
          )}
        </div>

        {/* CARDS SECTION */}
        {state.playerMode === 'spectator' ? (
          <SpectatorCard />
        ) : (
          <div className={`flex-1 overflow-hidden min-h-0 gap-1 ${cardCount === 3 ? 'grid grid-cols-3' : 'flex flex-col'}`}>
            {state.bingoCards.map(card => {
              const isCardEliminated = state.eliminatedCardIds.has(card.id);
              return (
                <div key={card.id} className="flex flex-col gap-0.5 min-h-0 flex-1">
                  <BingoBoard
                    card={card}
                    daubedNumbers={state.daubedNumbers}
                    isEliminated={isCardEliminated}
                    onDaub={onDaub}
                    compact={cardCount === 2}
                    extraCompact={cardCount === 3}
                  />
                  {!isCardEliminated && !allEliminated && (
                    <button
                      onClick={() => handleClaim(card.id)}
                      disabled={daubedCount < 5}
                      className={`gradient-winner rounded-xl font-black text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:scale-100 shrink-0
                        ${cardCount === 3 ? 'px-1 py-0.5 text-[8px] rounded' : cardCount === 2 ? 'px-3 py-0.5 text-[10px] rounded-lg' : 'px-6 py-2.5 text-base'}`}
                    >
                      🎯 {cardCount === 3 ? `#${card.id}` : `BINGO!`} {daubedCount < 5 && `(${daubedCount}/5)`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

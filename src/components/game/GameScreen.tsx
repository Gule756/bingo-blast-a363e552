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
  const handleClaim = (cardId: number) => {
    hapticImpact('heavy');
    onClaim(cardId);
  };

  const hasCards = state.bingoCards.length > 0;
  const cardCount = state.bingoCards.length;
  const allEliminated = state.bingoCards.every(c => state.eliminatedCardIds.has(c.id));

  const statusText = allEliminated ? '❌ All cards eliminated — Watching' :
    state.playerMode === 'spectator' ? '👁️ Spectator Mode' :
    hasCards ? `Playing ${cardCount} card${cardCount > 1 ? 's' : ''}` : 'Started';

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <StatsBar stats={state.stats} balance={state.user.balance} onClose={onClose} />

      <div className="py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
        {statusText}
      </div>

      {/* Single card layout */}
      {cardCount <= 1 && (
        <div className="flex flex-1 gap-1.5 overflow-hidden px-1.5 pb-1.5">
          <div className="w-[38%] shrink-0 overflow-y-auto">
            <BoardSidebar calledNumbers={state.calledNumbers} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
            <NumberCaller calledNumbers={state.calledNumbers} />
            {state.playerMode === 'spectator' ? (
              <SpectatorCard />
            ) : state.bingoCards[0] ? (
              <>
                <BingoBoard
                  card={state.bingoCards[0]}
                  daubedNumbers={state.daubedNumbers}
                  isEliminated={state.eliminatedCardIds.has(state.bingoCards[0].id)}
                  onDaub={onDaub}
                />
                {!state.eliminatedCardIds.has(state.bingoCards[0].id) && !allEliminated && (
                  <button
                    onClick={() => handleClaim(state.bingoCards[0].id)}
                    disabled={daubedCount < 5}
                    className="gradient-winner rounded-xl px-6 py-2.5 text-base font-black text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:scale-100"
                  >
                    🎯 BINGO! {daubedCount < 5 && `(${daubedCount}/5)`}
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Two cards layout: horizontal board on top, two cards stacked below */}
      {cardCount === 2 && (
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden px-1 pb-1">
          {/* Top section: horizontal board + compact caller */}
          <div className="flex gap-1 shrink-0" style={{ height: '22%' }}>
            <div className="flex-1 overflow-hidden">
              <BoardSidebar calledNumbers={state.calledNumbers} compact horizontal />
            </div>
            <div className="w-[30%] shrink-0 flex flex-col justify-center">
              <NumberCaller calledNumbers={state.calledNumbers} compact />
            </div>
          </div>
          {/* Bottom: 2 cards stacked */}
          {state.playerMode === 'spectator' ? (
            <SpectatorCard />
          ) : (
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden min-h-0">
              {state.bingoCards.map(card => {
                const isCardEliminated = state.eliminatedCardIds.has(card.id);
                return (
                  <div key={card.id} className="flex-1 flex flex-col gap-0.5 min-h-0">
                    <BingoBoard
                      card={card}
                      daubedNumbers={state.daubedNumbers}
                      isEliminated={isCardEliminated}
                      onDaub={onDaub}
                      extraCompact
                    />
                    {!isCardEliminated && !allEliminated && (
                      <button
                        onClick={() => handleClaim(card.id)}
                        disabled={daubedCount < 5}
                        className="gradient-winner rounded-lg px-3 py-0.5 text-[10px] font-black text-primary-foreground shadow transition-transform active:scale-95 disabled:opacity-40 disabled:scale-100 shrink-0"
                      >
                        🎯 BINGO #{card.id}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Three cards layout: horizontal board + small caller on top, 3 cards side by side at bottom */}
      {cardCount === 3 && (
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden px-1 pb-1">
          {/* Top section: wide horizontal board + compact caller */}
          <div className="flex gap-1 shrink-0" style={{ height: '28%' }}>
            <div className="flex-1 overflow-hidden">
              <BoardSidebar calledNumbers={state.calledNumbers} compact horizontal />
            </div>
            <div className="w-[30%] shrink-0 flex flex-col justify-center">
              <NumberCaller calledNumbers={state.calledNumbers} compact />
            </div>
          </div>
          {/* Bottom: 3 cards side by side */}
          {state.playerMode === 'spectator' ? (
            <SpectatorCard />
          ) : (
            <div className="flex flex-1 gap-0.5 overflow-hidden min-h-0">
              {state.bingoCards.map(card => {
                const isCardEliminated = state.eliminatedCardIds.has(card.id);
                return (
                  <div key={card.id} className="flex-1 flex flex-col gap-0.5 min-w-0 min-h-0">
                    <BingoBoard
                      card={card}
                      daubedNumbers={state.daubedNumbers}
                      isEliminated={isCardEliminated}
                      onDaub={onDaub}
                      extraCompact
                    />
                    {!isCardEliminated && !allEliminated && (
                      <button
                        onClick={() => handleClaim(card.id)}
                        disabled={daubedCount < 5}
                        className="gradient-winner rounded px-1 py-0.5 text-[8px] font-black text-primary-foreground shadow transition-transform active:scale-95 disabled:opacity-40 disabled:scale-100 shrink-0"
                      >
                        🎯 #{card.id}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

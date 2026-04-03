import { GameState } from '@/types/game';
import { StatsBar } from './StatsBar';
import { NumberCaller } from './NumberCaller';
import { BingoBoard } from './BingoBoard';
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
  const allEliminated = state.bingoCards.every(c => state.eliminatedCardIds.has(c.id));
  const cardCount = state.bingoCards.length;

  const handleClaim = (cardId: number) => {
    hapticImpact('heavy');
    onClaim(cardId);
  };

  const renderCard = (card: typeof state.bingoCards[0], compact?: boolean, extraCompact?: boolean) => {
    const isEliminated = state.eliminatedCardIds.has(card.id);
    return (
      <div key={card.id} className="flex flex-col min-h-0 min-w-0 flex-1 max-w-[400px]">
        <div className="flex-1 min-h-0">
          <BingoBoard
            card={card}
            daubedNumbers={state.daubedNumbers}
            isEliminated={isEliminated}
            onDaub={onDaub}
            compact={compact}
            extraCompact={extraCompact}
            className="h-full w-full"
          />
        </div>
        {!isEliminated && !allEliminated && (
          <button
            onClick={() => handleClaim(card.id)}
            disabled={daubedCount < 5}
            className="gradient-winner shrink-0 w-full py-1.5 lg:py-2 rounded-lg font-black text-white shadow-lg active:scale-95 disabled:opacity-30 uppercase text-[10px] tracking-tighter mt-1"
          >
            Bingo!
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* STATS BAR - fixed thin strip */}
      <div className="w-full shrink-0 z-[100] border-b border-border">
        <StatsBar stats={state.stats} balance={state.user.balance} onClose={onClose} />
      </div>

      {/* ===== DESKTOP (lg+): Split-screen ===== */}
      <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar - fixed width */}
        <div className="w-64 xl:w-72 shrink-0 h-full border-r border-border overflow-y-auto no-scrollbar">
          <BoardSidebar calledNumbers={state.calledNumbers} layout="vertical" />
        </div>

        {/* Right main stage */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Caller - auto height */}
          <div className="shrink-0 p-3 flex justify-center">
            <div className="w-full max-w-xl">
              <NumberCaller calledNumbers={state.calledNumbers} size="normal" />
            </div>
          </div>

          {/* Cards area - fills remaining */}
          <div className="flex-1 min-h-0 flex items-center justify-center gap-4 p-3 overflow-hidden">
            {state.bingoCards.map(card => renderCard(card, cardCount > 1))}
          </div>
        </div>
      </div>

      {/* ===== TABLET (md to lg): Vertical hybrid ===== */}
      <div className="hidden md:flex lg:hidden flex-1 flex-col min-h-0 overflow-hidden">
        {/* Top: Sidebar as compact horizontal strip - 28% */}
        <div className="h-[28%] shrink-0 overflow-hidden border-b border-border">
          <BoardSidebar calledNumbers={state.calledNumbers} layout="horizontal" />
        </div>

        {/* Caller - 12% */}
        <div className="h-[12%] shrink-0 flex items-center justify-center px-4 overflow-hidden">
          <div className="w-full max-w-lg">
            <NumberCaller calledNumbers={state.calledNumbers} size="compact" />
          </div>
        </div>

        {/* Cards - 60% */}
        <div className="flex-1 min-h-0 flex items-stretch justify-center gap-3 p-2 overflow-hidden">
          {state.bingoCards.map(card => renderCard(card, true))}
        </div>
      </div>

      {/* ===== MOBILE (<md): Vertical 30/20/50 ===== */}
      <div className="flex md:hidden flex-1 flex-col min-h-0 overflow-hidden">
        {/* Sidebar - 30% */}
        <div className="h-[30%] shrink-0 overflow-hidden border-b border-border">
          <BoardSidebar calledNumbers={state.calledNumbers} layout="horizontal" />
        </div>

        {/* Caller - 20% */}
        <div className="h-[20%] shrink-0 flex items-center justify-center px-2 overflow-hidden">
          <div className="w-full max-w-md">
            <NumberCaller calledNumbers={state.calledNumbers} size="compact" />
          </div>
        </div>

        {/* Cards - 50% */}
        <div className="h-[50%] min-h-0 flex items-stretch justify-center gap-1 p-1 overflow-hidden">
          {state.bingoCards.map(card => renderCard(card, cardCount >= 2, cardCount >= 3))}
        </div>
      </div>
    </div>
  );
}

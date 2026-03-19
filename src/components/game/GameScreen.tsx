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

  const handleClaim = () => {
    hapticImpact('heavy');
    onClaim();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <StatsBar stats={state.stats} balance={state.user.balance} onClose={onClose} />

      <div className="p-2 text-center text-sm font-semibold text-muted-foreground">
        {state.playerMode === 'eliminated' ? '❌ Eliminated — Watching' : 'Started'}
      </div>

      <div className="flex flex-1 gap-2 overflow-hidden px-2 pb-2">
        {/* Sidebar - called numbers board */}
        <div className="w-[38%] shrink-0 overflow-y-auto">
          <BoardSidebar calledNumbers={state.calledNumbers} />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <NumberCaller calledNumbers={state.calledNumbers} />

          {state.playerMode === 'spectator' ? (
            <SpectatorCard />
          ) : state.bingoCard ? (
            <>
              <BingoBoard
                card={state.bingoCard}
                calledNumbers={state.calledNumbers}
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

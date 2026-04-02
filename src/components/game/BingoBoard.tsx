import { motion } from 'framer-motion';
import { BingoCard, BINGO_LETTERS, getLetterColor } from '@/types/game';

interface BingoBoardProps {
  card: BingoCard;
  daubedNumbers: Set<number>;
  isEliminated: boolean;
  onDaub: (num: number) => void;
  compact?: boolean;
  extraCompact?: boolean;
}

export function BingoBoard({ card, daubedNumbers, isEliminated, onDaub, compact, extraCompact }: BingoBoardProps) {
  const cellSize = extraCompact ? 'h-5 text-[8px]' : compact ? 'h-8 text-[10px]' : 'h-12 text-sm';
  const headerSize = extraCompact ? 'h-4 text-[8px]' : compact ? 'h-6 text-[10px]' : 'h-9 text-sm';
  const isSmall = compact || extraCompact;

  return (
    <div className={`rounded-xl bg-card ${isSmall ? 'p-1' : 'p-3'} relative ${isEliminated ? 'eliminated-board' : ''} flex-1 min-h-0 flex flex-col`}>
      {isEliminated && (
        <div className="absolute inset-0 rounded-xl bg-destructive/30 backdrop-blur-[2px] z-10 flex items-center justify-center">
          <span className={`${isSmall ? 'text-xs' : 'text-lg'} font-black text-destructive-foreground drop-shadow-lg`}>❌ ELIMINATED</span>
        </div>
      )}
      {!extraCompact && <div className={`${isSmall ? 'mb-0.5 text-[9px]' : 'mb-1 text-xs'} text-center text-muted-foreground`}>Board #{card.id}</div>}

      {/* Header */}
      <div className="mb-0.5 grid grid-cols-5 gap-0.5">
        {BINGO_LETTERS.map(l => (
          <div key={l} className={`${getLetterColor(l)} flex ${headerSize} items-center justify-center rounded-md font-bold`}>
            {l}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-0.5">
        {card.numbers.flatMap((row, r) =>
          row.map((num, c) => {
            const isFree = r === 2 && c === 2;
            const isDaubed = isFree || (num !== null && daubedNumbers.has(num));
            const cellClass = isDaubed ? 'cell-daubed' : 'cell-default';

            return (
              <motion.button
                key={`${r}-${c}`}
                whileTap={!isEliminated && !isFree ? { scale: 0.9 } : {}}
                onClick={() => num !== null && !isFree && !isEliminated && onDaub(num)}
                className={`${cellClass} flex ${cellSize} items-center justify-center rounded-md font-semibold transition-colors`}
              >
                {isFree ? '★' : num}
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}

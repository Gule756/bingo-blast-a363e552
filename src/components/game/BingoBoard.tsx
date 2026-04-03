import { motion } from 'framer-motion';
import { BingoCard, BINGO_LETTERS, getLetterColor } from '@/types/game';

interface BingoBoardProps {
  card: BingoCard;
  daubedNumbers: Set<number>;
  isEliminated: boolean;
  onDaub: (num: number) => void;
  compact?: boolean;
  extraCompact?: boolean;
  className?: string;
}

export function BingoBoard({ 
  card, 
  daubedNumbers, 
  isEliminated, 
  onDaub, 
  compact, 
  extraCompact, 
  className 
}: BingoBoardProps) {
  const isSmall = compact || extraCompact;

  return (
    <div className={`
      relative rounded-xl bg-card flex flex-col 
      /* FIX: Changed w-60 to w-full and h-80 to h-full + min-h-0 */
      w-full h-full min-h-0 
      ${isSmall ? 'p-1' : 'p-3'} 
      ${isEliminated ? 'eliminated-board' : ''} 
      ${className || ''}
    `}>
      
      {/* Elimination Overlay */}
      {isEliminated && (
        <div className="absolute inset-0 rounded-xl bg-destructive/30 backdrop-blur-[2px] z-10 flex items-center justify-center">
          <span className={`${isSmall ? 'text-[10px]' : 'text-lg'} font-black text-destructive-foreground drop-shadow-lg uppercase`}>
            ❌ ELIMINATED
          </span>
        </div>
      )}

      {/* Board Header */}
      {!extraCompact && (
        <div className={`${isSmall ? 'mb-0.5 text-[8px]' : 'mb-1 text-xs'} text-center text-muted-foreground shrink-0 uppercase`}>
          Board #{card.id}
        </div>
      )}

      <div className="flex flex-col flex-1 gap-0.5 min-h-0">
        {/* Bingo Letters Row (B-I-N-G-O) */}
        <div className={`grid grid-cols-5 gap-0.5 shrink-0 ${isSmall ? 'h-6' : 'h-8'}`}>
          {BINGO_LETTERS.map(l => (
            <div 
              key={l} 
              className={`${getLetterColor(l)} flex items-center justify-center rounded-md font-bold ${isSmall ? 'text-[10px]' : 'text-sm'} h-full`}
            >
              {l}
            </div>
          ))}
        </div>

        {/* 5x5 Grid Numbers */}
        <div className="grid grid-cols-5 grid-rows-5 gap-0.5 flex-1 min-h-0">
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
                  /* text-[2.5vw] ensures text shrinks on small screens, md:text-base caps it for desktop */
                  className={`
                    ${cellClass} flex items-center justify-center rounded-sm md:rounded-lg 
                    font-semibold transition-colors h-full w-full 
                    ${isSmall ? 'text-[9px]' : 'text-[10px] sm:text-sm md:text-base'}
                  `}
                >
                  {isFree ? '★' : num}
                </motion.button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
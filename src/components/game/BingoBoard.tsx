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
      w-full h-full min-h-0 
      ${isSmall ? 'p-1' : 'p-2 md:p-3'} 
      ${isEliminated ? 'opacity-40' : ''} 
      ${className || ''}
    `}>
      
      {/* Elimination Overlay */}
      {isEliminated && (
        <div className="absolute inset-0 rounded-xl bg-black/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <span className={`${isSmall ? 'text-[10px]' : 'text-lg'} font-black text-white border-2 border-white px-2 -rotate-12 uppercase`}>
            OUT
          </span>
        </div>
      )}

      {/* Board Header */}
      {!extraCompact && (
        <div className={`${isSmall ? 'mb-0.5 text-[8px]' : 'mb-1 text-[10px]'} text-center text-muted-foreground shrink-0 uppercase font-bold opacity-60`}>
          #{card.id}
        </div>
      )}

      <div className="flex flex-col flex-1 gap-0.5 min-h-0">
        {/* Bingo Letters Row */}
        <div className={`grid grid-cols-5 gap-0.5 shrink-0 ${isSmall ? 'h-5' : 'h-7'}`}>
          {BINGO_LETTERS.map(l => (
            <div 
              key={l} 
              className={`${getLetterColor(l)} flex items-center justify-center rounded-sm font-black ${isSmall ? 'text-[9px]' : 'text-xs'} h-full text-white shadow-sm`}
            >
              {l}
            </div>
          ))}
        </div>

        {/* 5x5 Grid Numbers 
            FORCED: text-[10px] and min-h-0 allows the grid to shrink inside the 50% zone
        */}
        <div className="grid grid-cols-5 grid-rows-5 gap-0.5 flex-1 min-h-0 bg-white/5 p-0.5 rounded-sm">
          {card.numbers.flatMap((row, r) =>
            row.map((num, c) => {
              const isFree = r === 2 && c === 2;
              const isDaubed = isFree || (num !== null && daubedNumbers.has(num));
              
              return (
                <motion.button
                  key={`${r}-${c}`}
                  whileTap={!isEliminated && !isFree ? { scale: 0.92 } : {}}
                  onClick={() => num !== null && !isFree && !isEliminated && onDaub(num)}
                  className={`
                    flex items-center justify-center rounded-sm transition-all h-full w-full font-bold
                    text-[10px] sm:text-xs md:text-base
                    ${isDaubed ? 'bg-green-600 text-white shadow-inner' : 'bg-slate-800/60 text-white/90 hover:bg-slate-700'}
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
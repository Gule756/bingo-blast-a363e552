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
      ${isSmall ? 'p-1' : 'p-1.5 md:p-3'} 
      ${isEliminated ? 'opacity-40' : ''} 
      ${className || ''}
    `}>
      
      {/* Elimination Overlay */}
      {isEliminated && (
        <div className="absolute inset-0 rounded-xl bg-black/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <span className="text-[10px] font-black text-white border-2 border-white px-2 -rotate-12 uppercase">
            OUT
          </span>
        </div>
      )}

      {/* Board ID - Minimal height */}
      {!extraCompact && (
        <div className="mb-0.5 text-[8px] text-center text-muted-foreground shrink-0 uppercase font-bold opacity-60">
          #{card.id}
        </div>
      )}

      <div className="flex flex-col flex-1 gap-1 min-h-0">
        {/* BINGO Letters (Header) - Forced Height */}
        <div className="grid grid-cols-5 gap-0.5 shrink-0 h-[12%] min-h-[18px]">
          {BINGO_LETTERS.map(l => (
            <div 
              key={l} 
              className={`${getLetterColor(l)} flex items-center justify-center rounded-sm font-black text-[9px] h-full text-white shadow-sm`}
            >
              {l}
            </div>
          ))}
        </div>

        {/* 5x5 Number Grid 
            min-h-0 is CRITICAL: it tells the grid "don't expand beyond your parent"
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
                  /* h-full and w-full inside the grid rows/cols 
                     forced by GameScreen's 50dvh container 
                  */
                  className={`
                    flex items-center justify-center rounded-sm transition-all h-full w-full font-bold
                    text-[11px] leading-none select-none
                    ${isDaubed ? 'bg-green-600 text-white shadow-inner' : 'bg-slate-800/60 text-white/90'}
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
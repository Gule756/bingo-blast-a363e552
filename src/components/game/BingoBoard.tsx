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
  const cellText = extraCompact ? 'text-[8px]' : compact ? 'text-[10px]' : 'text-[11px] md:text-sm';
  const headerText = extraCompact ? 'text-[7px]' : compact ? 'text-[9px]' : 'text-[9px] md:text-xs';
  const pad = (compact || extraCompact) ? 'p-0.5' : 'p-1 md:p-2';

  return (
    <div className={`
      relative rounded-xl bg-card flex flex-col 
      w-full h-full min-h-0 ${pad}
      ${isEliminated ? 'opacity-40' : ''} 
      ${className || ''}
    `}>
      {/* Elimination Overlay */}
      {isEliminated && (
        <div className="absolute inset-0 rounded-xl bg-black/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <span className="text-[10px] font-black text-foreground border-2 border-foreground px-2 -rotate-12 uppercase">
            OUT
          </span>
        </div>
      )}

      {/* Board ID */}
      {!extraCompact && (
        <div className="mb-0.5 text-[8px] text-center text-muted-foreground shrink-0 uppercase font-bold opacity-60">
          #{card.id}
        </div>
      )}

      <div className="flex flex-col flex-1 gap-0.5 min-h-0">
        {/* BINGO Letters Header */}
        <div className="grid grid-cols-5 gap-0.5 shrink-0">
          {BINGO_LETTERS.map(l => (
            <div 
              key={l} 
              className={`${getLetterColor(l)} flex items-center justify-center rounded-sm font-black ${headerText} aspect-[2/1] text-white`}
            >
              {l}
            </div>
          ))}
        </div>

        {/* 5x5 Number Grid - flex-1 + min-h-0 prevents overflow */}
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
                    ${cellText} leading-none select-none
                    ${isDaubed ? 'bg-accent text-accent-foreground shadow-inner' : 'bg-secondary text-secondary-foreground'}
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

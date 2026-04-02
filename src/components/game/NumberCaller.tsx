import { motion, AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { CalledNumber, getLetterColor } from '@/types/game';

interface NumberCallerProps {
  calledNumbers: CalledNumber[];
  compact?: boolean;
}

export const NumberCaller = memo(({ calledNumbers, compact }: NumberCallerProps) => {
  const current = calledNumbers[calledNumbers.length - 1];
  const recent = calledNumbers.slice(-4, -1).reverse();

  if (!current) return null;

  return (
    <div className={compact ? 'space-y-1' : 'space-y-3'}>
      <div className={`gradient-hero flex items-center justify-between rounded-xl ${compact ? 'px-3 py-1.5' : 'px-5 py-3'}`}>
        <span className={`${compact ? 'text-[10px]' : 'text-sm'} font-semibold text-primary-foreground/80`}>
          {compact ? 'Current' : 'Current Call'}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={current.number}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className={`inline-flex items-center justify-center rounded-full font-mono font-bold bg-bingo-g text-primary-foreground ring-2 ring-primary-foreground/30 ${compact ? 'px-2.5 py-1 text-sm' : 'number-badge'}`}
          >
            {current.letter}-{current.number}
          </motion.span>
        </AnimatePresence>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col items-center gap-1">
          {!compact && <p className="text-center text-xs text-muted-foreground">Recent Calls</p>}
          <div className="flex justify-center gap-1.5">
            {recent.map(c => (
              <span key={c.number} className={`inline-flex items-center justify-center rounded-full font-mono font-bold ${getLetterColor(c.letter)} opacity-80 ${compact ? 'px-2 py-0.5 text-[10px]' : 'number-badge'}`}>
                {c.letter}-{c.number}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

import { motion, AnimatePresence } from 'framer-motion';
import { CalledNumber, getLetterColor } from '@/types/game';

interface NumberCallerProps {
  calledNumbers: CalledNumber[];
  size?: 'normal' | 'compact';
  compact?: boolean; // legacy prop
}

export function NumberCaller({ calledNumbers, size, compact: legacyCompact }: NumberCallerProps) {
  const current = calledNumbers[calledNumbers.length - 1];
  const recent = calledNumbers.slice(-4, -1).reverse();
  const isCompact = size === 'compact' || legacyCompact;

  if (!current) return null;

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="gradient-hero flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1">
          <span className="text-[10px] font-semibold text-primary-foreground/80 shrink-0">Now</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={current.number}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="inline-flex items-center justify-center rounded-full px-2.5 py-1 font-mono font-bold text-sm bg-accent text-accent-foreground ring-2 ring-primary-foreground/30"
            >
              {current.letter}-{current.number}
            </motion.span>
          </AnimatePresence>
        </div>
        {recent.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {recent.map(c => (
              <span key={c.number} className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono font-bold text-[10px] ${getLetterColor(c.letter)} opacity-80`}>
                {c.letter}-{c.number}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="gradient-hero flex items-center justify-between rounded-xl px-5 py-3">
        <span className="text-sm font-semibold text-primary-foreground/80">Current Call</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={current.number}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="number-badge bg-accent text-accent-foreground ring-2 ring-primary-foreground/30"
          >
            {current.letter}-{current.number}
          </motion.span>
        </AnimatePresence>
      </div>

      {recent.length > 0 && (
        <div className="space-y-1">
          <p className="text-center text-xs text-muted-foreground">Recent Calls</p>
          <div className="flex justify-center gap-2">
            {recent.map(c => (
              <span key={c.number} className={`number-badge ${getLetterColor(c.letter)} opacity-80`}>
                {c.letter}-{c.number}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

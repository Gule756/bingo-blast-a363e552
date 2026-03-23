import { motion, AnimatePresence } from 'framer-motion';
import { CalledNumber, getLetterColor } from '@/types/game';

interface NumberCallerProps {
  calledNumbers: CalledNumber[];
}

export function NumberCaller({ calledNumbers }: NumberCallerProps) {
  const current = calledNumbers[calledNumbers.length - 1];
  const recent = calledNumbers.slice(-4, -1).reverse();

  if (!current) return null;

  return (
    <div className="space-y-3">
      <div className="gradient-hero flex items-center justify-between rounded-xl px-5 py-3">
        <span className="text-sm font-semibold text-primary-foreground/80">Current Call</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={current.number}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="number-badge bg-bingo-g text-primary-foreground ring-2 ring-primary-foreground/30"
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

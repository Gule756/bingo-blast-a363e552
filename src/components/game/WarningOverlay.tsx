import { motion } from 'framer-motion';

interface WarningOverlayProps {
  timer: number;
}

// Non-blocking toast/banner at the top — users can still interact with lobby grid
export function WarningOverlay({ timer }: WarningOverlayProps) {
  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      className="fixed left-2 right-2 top-2 z-50"
    >
      <div className="gradient-danger flex items-center gap-3 rounded-xl p-3 shadow-lg">
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="text-2xl"
        >
          ⏰
        </motion.span>
        <div className="flex-1">
          <p className="text-sm font-bold text-primary-foreground">
            Game starting in {timer}s — Hurry!
          </p>
          <p className="text-xs text-primary-foreground/80">You can still select your card!</p>
        </div>
        <motion.div
          key={timer}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20 text-xl font-black text-primary-foreground"
        >
          {timer}
        </motion.div>
      </div>
    </motion.div>
  );
}

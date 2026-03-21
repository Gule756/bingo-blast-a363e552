import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BingoCard, BINGO_LETTERS, getLetterColor, DUMMY_NAMES, WinPattern } from '@/types/game';

interface GameOverScreenProps {
  winner: string | null;
  winPattern: WinPattern;
  winningCells: [number, number][];
  card: BingoCard | null;
  daubedNumbers: Set<number>;
  stats: { bet: number; players: number };
  balance: number;
  currentPlayerName: string;
  onReturn: () => void;
}

function isWinningCell(r: number, c: number, cells: [number, number][]): boolean {
  return cells.some(([wr, wc]) => wr === r && wc === c);
}

export function GameOverScreen({ winner, winPattern, winningCells, card, daubedNumbers, stats, balance, currentPlayerName, onReturn }: GameOverScreenProps) {
  const [countdown, setCountdown] = useState(10);
  const prize = stats.bet * stats.players * 0.9;
  const isDummy = winner ? DUMMY_NAMES.includes(winner) : false;
  const isMe = winner !== null && !isDummy && winner === currentPlayerName;
  const someoneElseWon = winner !== null && !isMe;

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); onReturn(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onReturn]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-background to-card p-4">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-2 text-6xl">
        {isMe ? '🎉' : winner ? '😔' : '😔'}
      </motion.div>

      {isMe ? (
        <>
          <h1 className="mb-1 text-3xl font-black text-accent">You Won!</h1>
          <div className="mb-4 rounded-xl border-2 border-accent bg-accent/10 px-6 py-3 text-center">
            <div className="text-sm text-muted-foreground">Prize Won</div>
            <div className="text-3xl font-black text-accent">{Math.floor(prize)} ETB</div>
          </div>
        </>
      ) : someoneElseWon ? (
        <>
          <h1 className="mb-1 text-3xl font-black text-foreground">Game Over!</h1>
          <p className="mb-1 text-lg font-bold text-destructive">
            {isDummy ? `User ${winner} has won!` : `${winner} wins!`}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">Better luck next round!</p>
        </>
      ) : (
        <>
          <h1 className="mb-1 text-3xl font-black text-foreground">Game Over!</h1>
          <p className="mb-4 text-sm text-muted-foreground">No winner this round.</p>
        </>
      )}

      <div className="mb-4 rounded-xl bg-card px-6 py-3 text-center">
        <p className="text-xs text-muted-foreground">Your Balance</p>
        <p className="text-2xl font-black text-foreground">{balance} ETB</p>
      </div>

      {card && isMe && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-4 w-full max-w-xs rounded-2xl border-4 border-yellow-400 bg-yellow-50/10 p-4"
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-sm font-bold text-foreground">{currentPlayerName}</span>
            {winPattern && (
              <span className="rounded-full border border-muted bg-card px-3 py-0.5 text-xs font-bold text-muted-foreground">
                {winPattern}
              </span>
            )}
          </div>
          <div className="mb-2 rounded bg-card px-3 py-1 text-center text-xs font-bold text-muted-foreground">
            Board #{card.id}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {BINGO_LETTERS.map(l => (
              <div key={l} className={`${getLetterColor(l)} flex h-7 items-center justify-center rounded text-xs font-bold`}>{l}</div>
            ))}
            {card.numbers.flatMap((row, r) =>
              row.map((num, c) => {
                const isFree = r === 2 && c === 2;
                const isDaubed = isFree || (num !== null && daubedNumbers.has(num));
                const isWin = isWinningCell(r, c, winningCells);
                return (
                  <motion.div
                    key={`${r}-${c}`}
                    initial={isWin ? { scale: 1 } : {}}
                    animate={isWin ? { scale: 1.15, y: -3 } : {}}
                    transition={isWin ? { repeat: Infinity, repeatType: 'reverse', duration: 1.2 } : {}}
                    className={`flex h-8 items-center justify-center rounded text-xs font-semibold ${
                      isWin
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/40 ring-2 ring-sky-300 z-10'
                        : isDaubed
                          ? 'cell-daubed'
                          : 'bg-card text-muted-foreground'
                    }`}
                  >
                    {isFree ? '★' : num}
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      <div className="mt-auto text-center">
        <p className="text-sm text-muted-foreground">Auto-return to lobby in</p>
        <motion.div key={countdown} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="my-2 flex h-14 w-14 mx-auto items-center justify-center rounded-xl bg-primary text-2xl font-black text-primary-foreground">
          {countdown}
        </motion.div>
        <p className="text-xs text-muted-foreground">All players return together at the same time</p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BingoCard, BINGO_LETTERS, getLetterColor, DUMMY_NAMES, WinPattern } from '@/types/game';

interface GameOverScreenProps {
  winner: string | null;
  winnerCount: number;
  winPattern: WinPattern;
  winningCells: [number, number][];
  winningCardId: number | null;
  cards: BingoCard[];
  daubedNumbers: Set<number>;
  stats: { bet: number; players: number };
  balance: number;
  currentPlayerName: string;
  onReturn: () => void;
}

function isWinningCell(r: number, c: number, cells: [number, number][]): boolean {
  return cells.some(([wr, wc]) => wr === r && wc === c);
}

export function GameOverScreen({ winner, winnerCount, winPattern, winningCells, winningCardId, cards, daubedNumbers, stats, balance, currentPlayerName, onReturn }: GameOverScreenProps) {
  const [countdown, setCountdown] = useState(10);
  const totalPrize = stats.bet * stats.players * 0.9;
  const prize = winnerCount > 1 ? totalPrize / winnerCount : totalPrize;
  const isDummy = winner ? DUMMY_NAMES.includes(winner) : false;
  const isMe = winner !== null && !isDummy && winner === currentPlayerName;
  const someoneElseWon = winner !== null && !isMe;

  const winningCard = winningCardId !== null ? cards.find(c => c.id === winningCardId) : null;

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
        {isMe ? '🎉' : '😔'}
      </motion.div>

      {isMe ? (
        <>
          <h1 className="mb-1 text-3xl font-black text-accent">You Won!</h1>
          {winnerCount > 1 && (
            <p className="mb-1 text-sm text-muted-foreground">
              Prize split between {winnerCount} winners
            </p>
          )}
          <div className="mb-4 rounded-xl border-2 border-accent bg-accent/10 px-6 py-3 text-center">
            <div className="text-sm text-muted-foreground">Prize Won</div>
            <div className="text-3xl font-black text-accent">{Math.floor(prize)} ETB</div>
          </div>
        </>
      ) : someoneElseWon ? (
        <>
          <h1 className="mb-1 text-3xl font-black text-foreground">Game Over!</h1>
          <p className="mb-1 text-lg font-bold text-accent">
            {isDummy ? `User ${winner} has won!` : `${winner} wins!`}
          </p>
          {winnerCount > 1 && (
            <p className="mb-1 text-sm text-muted-foreground">{winnerCount} winners split the prize</p>
          )}
          <p className="mb-4 text-sm text-accent">Better luck next round! 🍀</p>
        </>
      ) : (
        <>
          <h1 className="mb-1 text-3xl font-black text-foreground">Game Over!</h1>
          <p className="mb-4 text-sm text-accent">No winner this round. Try again! 🍀</p>
        </>
      )}

      <div className="mb-4 rounded-xl bg-card px-6 py-3 text-center">
        <p className="text-xs text-muted-foreground">Your Balance</p>
        <p className="text-2xl font-black text-foreground">{balance} ETB</p>
      </div>

      {winningCard && isMe && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-4 w-full max-w-xs rounded-2xl border-4 border-primary bg-primary/5 p-4"
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-sm font-bold text-foreground">{currentPlayerName}</span>
            {winPattern && (
              <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                {winPattern}
              </span>
            )}
          </div>
          <div className="mb-2 rounded bg-card px-3 py-1 text-center text-xs font-bold text-muted-foreground">
            Board #{winningCard.id}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {BINGO_LETTERS.map(l => (
              <div key={l} className={`${getLetterColor(l)} flex h-7 items-center justify-center rounded text-xs font-bold`}>{l}</div>
            ))}
            {winningCard.numbers.flatMap((row, r) =>
              row.map((num, c) => {
                const isFree = r === 2 && c === 2;
                const isDaubed = isFree || (num !== null && daubedNumbers.has(num));
                const isWin = isWinningCell(r, c, winningCells);
                return (
                  <motion.div
                    key={`${r}-${c}`}
                    initial={isWin ? { scale: 1 } : {}}
                    animate={isWin ? { scale: 1.2, y: -4 } : {}}
                    transition={isWin ? { repeat: Infinity, repeatType: 'reverse', duration: 1 } : {}}
                    className={`flex h-8 items-center justify-center rounded text-xs font-semibold ${
                      isWin
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-primary/60 z-10'
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
        <p className="text-sm text-muted-foreground">Auto-return in</p>
        <motion.div key={countdown} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="my-2 flex h-14 w-14 mx-auto items-center justify-center rounded-xl bg-primary text-2xl font-black text-primary-foreground">
          {countdown}
        </motion.div>
      </div>
    </div>
  );
}

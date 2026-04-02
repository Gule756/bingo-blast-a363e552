import { memo, useMemo } from 'react';
import { CalledNumber, BINGO_LETTERS, getLetterColor } from '@/types/game';

interface BoardSidebarProps {
  calledNumbers: CalledNumber[];
  boardSize?: number;
  compact?: boolean;
  horizontal?: boolean;
}

export const BoardSidebar = memo(({ calledNumbers, boardSize = 75, compact, horizontal }: BoardSidebarProps) => {
  const calledSet = useMemo(() => new Set(calledNumbers.map(c => c.number)), [calledNumbers]);
  const currentNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1].number : null;
  const ranges: [number, number][] = [[1,15],[16,30],[31,45],[46,60],[61,75]];

  return (
    <div className={`rounded-xl bg-card p-1.5 ${horizontal ? 'h-full flex flex-col' : ''}`}>
      <div className={`mb-0.5 text-center text-muted-foreground ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
        Board (1-{boardSize})
      </div>

      <div className={horizontal ? 'flex-1 grid grid-rows-5 gap-0.5 overflow-hidden' : ''}>
        {BINGO_LETTERS.map((letter, li) => {
          const [min] = ranges[li];

          if (horizontal) {
            return (
              <div key={letter} className="flex gap-0.5 items-stretch">
                <div className={`${getLetterColor(letter)} flex w-5 items-center justify-center rounded text-[7px] font-bold shrink-0`}>
                  {letter}
                </div>
                <div className="flex flex-1 gap-px">
                  {Array.from({ length: 15 }, (_, i) => {
                    const num = min + i;
                    if (num > 75) return <div key={i} className="flex-1" />;
                    const isCurrent = num === currentNumber;
                    const isCalled = calledSet.has(num) && !isCurrent;
                    return (
                      <div
                        key={num}
                        className={`flex-1 flex items-center justify-center rounded text-[7px] font-medium transition-colors ${
                          isCurrent ? 'cell-current-call' : isCalled ? 'cell-called-prev' : 'cell-default'
                        }`}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {!horizontal && (
        <>
          <div className="mb-0.5 grid grid-cols-5 gap-px">
            {BINGO_LETTERS.map(l => (
              <div key={l} className={`${getLetterColor(l)} flex ${compact ? 'h-4' : 'h-6'} items-center justify-center rounded ${compact ? 'text-[8px]' : 'text-[10px]'} font-bold`}>
                {l}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-px">
            {Array.from({ length: 15 }, (_, row) =>
              ranges.map(([min], col) => {
                const num = min + row;
                if (num > 75) return <div key={`${row}-${col}`} />;
                const isCurrent = num === currentNumber;
                const isCalled = calledSet.has(num) && !isCurrent;
                return (
                  <div
                    key={num}
                    className={`flex ${compact ? 'h-4' : 'h-6'} items-center justify-center rounded ${compact ? 'text-[8px]' : 'text-[10px]'} font-medium transition-colors ${
                      isCurrent ? 'cell-current-call' : isCalled ? 'cell-called-prev' : 'cell-default'
                    }`}
                  >
                    {num}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
});

import { CalledNumber, BINGO_LETTERS, getLetterColor } from '@/types/game';

interface BoardSidebarProps {
  calledNumbers: CalledNumber[];
  boardSize?: number;
  compact?: boolean;
  horizontal?: boolean;
}

export function BoardSidebar({ calledNumbers, boardSize = 75, compact, horizontal }: BoardSidebarProps) {
  const calledSet = new Set(calledNumbers.map(c => c.number));
  const currentNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1].number : null;
  const ranges: [number, number][] = [[1,15],[16,30],[31,45],[46,60],[61,75]];

  // Horizontal mode: render as rows per letter (B=1-15, I=16-30, etc.) laid out horizontally
  if (horizontal) {
    return (
      <div className="rounded-lg bg-card p-1 text-[7px] h-full flex flex-col">
        <div className="mb-0.5 text-center text-muted-foreground text-[7px]">Board (1-{boardSize})</div>
        <div className="flex-1 grid grid-rows-5 gap-px overflow-hidden">
          {BINGO_LETTERS.map((letter, li) => {
            const [min] = ranges[li];
            return (
              <div key={letter} className="flex gap-px items-center">
                <div className={`${getLetterColor(letter)} flex h-full w-5 items-center justify-center rounded text-[7px] font-bold shrink-0`}>
                  {letter}
                </div>
                {Array.from({ length: 15 }, (_, i) => {
                  const num = min + i;
                  if (num > 75) return <div key={i} className="flex-1" />;
                  const isCurrent = num === currentNumber;
                  const isCalled = calledSet.has(num) && !isCurrent;
                  return (
                    <div
                      key={num}
                      className={`flex-1 flex items-center justify-center rounded text-[7px] font-medium transition-colors ${
                        isCurrent
                          ? 'cell-current-call'
                          : isCalled
                            ? 'cell-called-prev'
                            : 'cell-default'
                      }`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const cellH = compact ? 'h-4' : 'h-6';
  const fontSize = compact ? 'text-[8px]' : 'text-[10px]';

  return (
    <div className="rounded-xl bg-card p-1.5 text-xs">
      <div className={`mb-0.5 text-center text-muted-foreground ${compact ? 'text-[8px]' : 'text-[10px]'}`}>Board (1-{boardSize})</div>
      {/* Header */}
      <div className="mb-0.5 grid grid-cols-5 gap-px">
        {BINGO_LETTERS.map(l => (
          <div key={l} className={`${getLetterColor(l)} flex ${cellH} items-center justify-center rounded ${fontSize} font-bold`}>
            {l}
          </div>
        ))}
      </div>
      {/* Numbers grid */}
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
                className={`flex ${cellH} items-center justify-center rounded ${fontSize} font-medium transition-colors ${
                  isCurrent
                    ? 'cell-current-call'
                    : isCalled
                      ? 'cell-called-prev'
                      : 'cell-default'
                }`}
              >
                {num}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

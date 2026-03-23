import { CalledNumber, BINGO_LETTERS, getLetterColor } from '@/types/game';

interface BoardSidebarProps {
  calledNumbers: CalledNumber[];
  boardSize?: number;
}

export function BoardSidebar({ calledNumbers, boardSize = 75 }: BoardSidebarProps) {
  const calledSet = new Set(calledNumbers.map(c => c.number));
  const currentNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1].number : null;
  const ranges: [number, number][] = [[1,15],[16,30],[31,45],[46,60],[61,75]];

  return (
    <div className="rounded-xl bg-card p-2 text-xs">
      <div className="mb-1 text-center text-muted-foreground">Board (1-{boardSize})</div>
      {/* Header */}
      <div className="mb-1 grid grid-cols-5 gap-0.5">
        {BINGO_LETTERS.map(l => (
          <div key={l} className={`${getLetterColor(l)} flex h-6 items-center justify-center rounded text-[10px] font-bold`}>
            {l}
          </div>
        ))}
      </div>
      {/* Numbers grid - yellow for current, green for previous */}
      <div className="grid grid-cols-5 gap-0.5">
        {Array.from({ length: 15 }, (_, row) =>
          ranges.map(([min], col) => {
            const num = min + row;
            if (num > 75) return <div key={`${row}-${col}`} />;
            const isCurrent = num === currentNumber;
            const isCalled = calledSet.has(num) && !isCurrent;
            return (
              <div
                key={num}
                className={`flex h-6 items-center justify-center rounded text-[10px] font-medium transition-colors ${
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

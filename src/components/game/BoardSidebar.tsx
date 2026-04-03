import { CalledNumber, BINGO_LETTERS, getLetterColor } from '@/types/game';

interface BoardSidebarProps {
  calledNumbers: CalledNumber[];
  boardSize?: number;
  layout?: 'vertical' | 'horizontal';
  compact?: boolean;
}

export function BoardSidebar({ calledNumbers, layout = 'vertical' }: BoardSidebarProps) {
  const calledSet = new Set(calledNumbers.map(c => c.number));
  const currentNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1].number : null;
  const ranges: [number, number][] = [[1,15],[16,30],[31,45],[46,60],[61,75]];

  // ===== HORIZONTAL layout (mobile/tablet) =====
  if (layout === 'horizontal') {
    return (
      <div className="h-full flex flex-col p-1.5 overflow-hidden">
        <div className="text-center text-muted-foreground text-[10px] font-medium mb-1 shrink-0">Called Numbers</div>
        <div className="flex-1 min-h-0 grid grid-rows-5 gap-px">
          {BINGO_LETTERS.map((letter, li) => {
            const [min] = ranges[li];
            return (
              <div key={letter} className="flex gap-px items-stretch min-h-0">
                <div className={`${getLetterColor(letter)} flex items-center justify-center w-6 shrink-0 rounded-sm text-[9px] font-black text-white`}>
                  {letter}
                </div>
                {Array.from({ length: 15 }, (_, i) => {
                  const num = min + i;
                  const isCurrent = num === currentNumber;
                  const isCalled = calledSet.has(num) && !isCurrent;
                  return (
                    <div
                      key={num}
                      className={`flex-1 flex items-center justify-center rounded-sm text-[8px] font-medium transition-colors ${
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

  // ===== VERTICAL layout (desktop sidebar) =====
  return (
    <div className="h-full flex flex-col p-2 text-sm">
      <div className="mb-2 text-center text-muted-foreground text-sm font-medium shrink-0">Called Numbers</div>
      {/* Header */}
      <div className="mb-1 grid grid-cols-5 gap-1 shrink-0">
        {BINGO_LETTERS.map(l => (
          <div key={l} className={`${getLetterColor(l)} flex h-6 items-center justify-center rounded-md text-xs font-bold text-white`}>
            {l}
          </div>
        ))}
      </div>
      {/* Numbers grid */}
      <div className="flex-1 min-h-0 grid grid-cols-5 grid-rows-[repeat(15,1fr)] gap-0.5 overflow-hidden">
        {Array.from({ length: 15 }, (_, row) =>
          ranges.map(([min], col) => {
            const num = min + row;
            if (num > 75) return <div key={`${row}-${col}`} />;
            const isCurrent = num === currentNumber;
            const isCalled = calledSet.has(num) && !isCurrent;
            return (
              <div
                key={num}
                className={`flex items-center justify-center rounded-md text-[10px] font-medium transition-colors ${
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

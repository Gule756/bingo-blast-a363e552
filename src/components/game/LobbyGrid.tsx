import { memo } from 'react';
import { motion } from 'framer-motion';

interface LobbyGridProps {
  selectedStacks: Set<number>;
  occupiedStacks: Set<number>;
  onSelect: (id: number) => void;
}

const StackCell = memo(({ id, isSelected, isOccupied, onSelect }: {
  id: number; isSelected: boolean; isOccupied: boolean; onSelect: (id: number) => void;
}) => {
  const cls = isSelected ? 'cell-selected' : isOccupied ? 'cell-taken' : 'cell-default';
  return (
    <button
      onClick={() => !isOccupied && onSelect(id)}
      disabled={isOccupied}
      className={`${cls} flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-all active:scale-95`}
    >
      {id}
    </button>
  );
});
StackCell.displayName = 'StackCell';

export function LobbyGrid({ selectedStacks, occupiedStacks, onSelect }: LobbyGridProps) {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm cell-selected" /> Your pick
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm cell-taken" /> Taken
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-10 gap-1.5"
      >
        {Array.from({ length: 100 }, (_, i) => i + 1).map(id => (
          <StackCell
            key={id}
            id={id}
            isSelected={selectedStacks.has(id)}
            isOccupied={occupiedStacks.has(id)}
            onSelect={onSelect}
          />
        ))}
      </motion.div>
    </div>
  );
}

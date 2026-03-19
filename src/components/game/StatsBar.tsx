interface StatsBarProps {
  stats: { players: number; bet: number; callCount: number };
  balance: number;
  onClose: () => void;
}

export function StatsBar({ stats, balance, onClose }: StatsBarProps) {
  return (
    <div className="flex items-center gap-1 bg-card p-2">
      <button onClick={onClose} className="mr-1 flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-xs text-foreground">
        ✕ <span className="font-medium">Close</span>
      </button>
      {[
        { label: 'Balance', value: `${balance}` },
        { label: 'Players', value: stats.players },
        { label: 'Bet', value: stats.bet },
        { label: 'Call', value: stats.callCount },
      ].map(s => (
        <div key={s.label} className="stat-card flex-1">
          <span className="text-[10px] text-muted-foreground">{s.label}</span>
          <span className="text-sm font-bold text-foreground">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

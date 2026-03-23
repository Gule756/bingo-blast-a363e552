import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { STAKE_OPTIONS, GameRoom } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';
import { hapticImpact, hapticSelection } from '@/lib/haptic';
import { User, LogOut } from 'lucide-react';

interface StakeSelectionScreenProps {
  balance: number;
  userName: string;
  onSelectStake: (stake: number) => void;
  onCreateGame: (stake: number, countdown: number) => void;
  onJoinGame: (gameId: string, stake: number) => void;
  onDeposit: () => void;
  onProfile: () => void;
}

export function StakeSelectionScreen({
  balance, userName, onSelectStake, onCreateGame, onJoinGame, onDeposit, onProfile
}: StakeSelectionScreenProps) {
  const [availableGames, setAvailableGames] = useState<GameRoom[]>([]);
  const [selectedStake, setSelectedStake] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);

  // Fetch available games
  useEffect(() => {
    const fetchGames = async () => {
      const { data } = await supabase
        .from('games')
        .select('*')
        .in('status', ['waiting', 'countdown'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        // Get player counts
        const gameIds = data.map(g => g.id);
        const { data: players } = await supabase
          .from('game_players')
          .select('game_id')
          .in('game_id', gameIds);

        const countMap: Record<string, number> = {};
        players?.forEach(p => {
          countMap[p.game_id] = (countMap[p.game_id] || 0) + 1;
        });

        setAvailableGames(data.map(g => ({
          id: g.id,
          stake: g.stake,
          status: g.status as GameRoom['status'],
          countdownSeconds: g.countdown_seconds,
          countdownStartedAt: g.countdown_started_at,
          playerCount: countMap[g.id] || 0,
          maxPlayers: g.max_players || 200,
          createdBy: g.created_by,
        })));
      }
    };

    fetchGames();
    const interval = setInterval(fetchGames, 3000);

    // Realtime subscription
    const channel = supabase
      .channel('games-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => fetchGames())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => fetchGames())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredGames = selectedStake
    ? availableGames.filter(g => g.stake === selectedStake)
    : [];

  const canCreateNewGame = (stake: number) => {
    const gamesAtStake = availableGames.filter(g => g.stake === stake);
    // Can create if no waiting/countdown games exist at this stake,
    // or if all games at this stake are already playing/full
    return gamesAtStake.every(g => g.status === 'playing' || g.playerCount >= g.maxPlayers);
  };

  const handleCreateGame = async () => {
    if (!selectedStake || loading) return;
    setLoading(true);
    hapticImpact('medium');
    onCreateGame(selectedStake, countdown);
    setShowCreateModal(false);
    setLoading(false);
  };

  const handleStakeClick = (stake: number) => {
    hapticSelection();
    setSelectedStake(stake === selectedStake ? null : stake);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between bg-card p-3">
        <div>
          <h1 className="text-lg font-black text-foreground">🎯 Habesha Bingo</h1>
          <p className="text-xs text-muted-foreground">Welcome, {userName}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-secondary px-3 py-1.5 text-center">
            <span className="text-[10px] text-muted-foreground">Balance</span>
            <p className="text-sm font-bold text-accent">{balance} ETB</p>
          </div>
          <button onClick={onProfile} className="rounded-lg bg-secondary p-2">
            <User className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>

      {/* Low balance warning */}
      {balance < 10 && (
        <div className="mx-3 mt-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm font-bold text-foreground">Low balance!</p>
          <p className="text-xs text-muted-foreground">Deposit to start playing.</p>
          <button onClick={onDeposit} className="mt-2 rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground">
            💰 Deposit Now
          </button>
        </div>
      )}

      {/* Stake Selection */}
      <div className="p-3">
        <h2 className="mb-2 text-sm font-bold text-foreground">Choose Stake Amount (ETB)</h2>
        <div className="grid grid-cols-4 gap-2">
          {STAKE_OPTIONS.map(stake => {
            const canAfford = balance >= stake;
            const isSelected = selectedStake === stake;
            return (
              <motion.button
                key={stake}
                whileTap={{ scale: 0.95 }}
                onClick={() => canAfford && handleStakeClick(stake)}
                disabled={!canAfford}
                className={`rounded-lg px-2 py-3 text-center text-sm font-bold transition-all ${
                  isSelected
                    ? 'bg-accent text-accent-foreground ring-2 ring-accent shadow-lg'
                    : canAfford
                      ? 'bg-card text-foreground hover:bg-secondary'
                      : 'bg-muted text-muted-foreground opacity-50'
                }`}
              >
                {stake}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Available Games for selected stake */}
      {selectedStake && (
        <div className="flex-1 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              Games at {selectedStake} ETB
            </h2>
            {(filteredGames.length === 0 || canCreateNewGame(selectedStake)) && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
              >
                + Create Game
              </button>
            )}
          </div>

          {filteredGames.length === 0 ? (
            <div className="rounded-xl bg-card p-6 text-center">
              <p className="text-2xl mb-2">🎲</p>
              <p className="text-sm text-muted-foreground">No games available at this stake.</p>
              <p className="text-xs text-muted-foreground mt-1">Create one and wait for others to join!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGames.map(game => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-xl bg-card p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{game.stake} ETB</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        game.status === 'waiting'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-primary/20 text-primary'
                      }`}>
                        {game.status === 'waiting' ? 'Waiting' : 'Starting...'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {game.playerCount}/{game.maxPlayers} players • {game.countdownSeconds}s countdown
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      hapticImpact('medium');
                      onJoinGame(game.id, game.stake);
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Join
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Game Modal */}
      {showCreateModal && selectedStake && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            className="w-full max-w-md rounded-t-2xl bg-card p-4 space-y-4"
          >
            <div className="mx-auto h-1 w-12 rounded-full bg-muted" />
            <h3 className="text-lg font-bold text-foreground">Create Game — {selectedStake} ETB</h3>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Countdown Timer</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {[30, 60, 120, 300].map(s => (
                  <button
                    key={s}
                    onClick={() => setCountdown(s)}
                    className={`rounded-lg py-2 text-xs font-bold ${
                      countdown === s
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    {s < 60 ? `${s}s` : `${s / 60}m`}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ⚠️ Countdown starts when at least 2 players join.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 rounded-xl bg-secondary py-3 font-bold text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGame}
                disabled={loading}
                className="flex-1 rounded-xl bg-accent py-3 font-bold text-accent-foreground"
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

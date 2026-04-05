import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, History, Wallet, Trophy, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/game';
import { toast } from 'sonner';

interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}

type TabType = 'overview' | 'history' | 'deposits' | 'withdrawals' | 'leaderboard';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  tx_hash: string | null;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  total_wins: number;
  balance: number;
}

export function ProfileScreen({ user, onBack, onDeposit, onWithdraw, onBalanceUpdate }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [resetting, setResetting] = useState(false);

  const isGule = user.name.toLowerCase() === 'gule';

  useEffect(() => {
    const fetchData = async () => {
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (txData) setTransactions(txData as Transaction[]);

      const { data: lbData } = await supabase
        .from('players')
        .select('id, name, total_wins, balance')
        .order('total_wins', { ascending: false })
        .limit(20);
      if (lbData) setLeaderboard(lbData as LeaderboardEntry[]);

      const { data: grData } = await supabase
        .from('game_results')
        .select('*, games(stake, status, finished_at)')
        .eq('player_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (grData) setGameHistory(grData);
    };
    fetchData();
  }, [user.id]);

  const handleResetBalance = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-balance', {
        body: { player_id: user.id, password: '123456' },
      });
      if (error) throw new Error(error.message);
      if (data.success) {
        onBalanceUpdate(data.new_balance);
        toast.success('Balance reset to 1,000,000 ETB');
      } else {
        toast.error(data.error || 'Reset failed');
      }
    } catch {
      toast.error('Failed to reset balance');
    }
    setResetting(false);
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'history', label: 'Games', icon: History },
    { key: 'deposits', label: 'Deposits', icon: Wallet },
    { key: 'withdrawals', label: 'Withdrawals', icon: Wallet },
    { key: 'leaderboard', label: 'Board', icon: Trophy },
  ];

  const deposits = transactions.filter(t => t.type === 'deposit');
  const withdrawals = transactions.filter(t => t.type === 'withdrawal');
  const wins = transactions.filter(t => t.type === 'win');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center gap-3 bg-card p-3">
        <button onClick={onBack} className="rounded-lg bg-secondary p-2">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{user.name}</h1>
          <p className="text-xs text-muted-foreground">{user.phone}</p>
        </div>
      </div>

      <div className="mx-3 mt-3 rounded-xl bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-3xl font-black text-accent">{user.balance} ETB</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onDeposit} className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground">
              Deposit
            </button>
            <button onClick={onWithdraw} className="rounded-lg bg-secondary px-4 py-2 text-xs font-bold text-foreground">
              Withdraw
            </button>
          </div>
        </div>
        {isGule && (
          <button
            onClick={handleResetBalance}
            disabled={resetting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive"
          >
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset to 1,000,000 ETB (Test)
          </button>
        )}
        <div className="mt-3 flex gap-4 text-center">
          <div className="flex-1 rounded-lg bg-secondary p-2">
            <p className="text-xs text-muted-foreground">Wins</p>
            <p className="text-lg font-bold text-foreground">{user.totalWins}</p>
          </div>
          <div className="flex-1 rounded-lg bg-secondary p-2">
            <p className="text-xs text-muted-foreground">Games</p>
            <p className="text-lg font-bold text-foreground">{gameHistory.length}</p>
          </div>
          <div className="flex-1 rounded-lg bg-secondary p-2">
            <p className="text-xs text-muted-foreground">Earned</p>
            <p className="text-lg font-bold text-accent">
              {Math.floor(wins.reduce((s, t) => s + Number(t.amount), 0))}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 px-3 pt-3 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold shrink-0 ${
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'overview' && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
            {transactions.slice(0, 10).map(tx => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg bg-card p-3">
                <div>
                  <span className={`text-xs font-bold ${
                    tx.type === 'win' ? 'text-accent' :
                    tx.type === 'bet' ? 'text-destructive' :
                    tx.type === 'deposit' ? 'text-primary' :
                    tx.type === 'withdrawal' ? 'text-bingo-o' : 'text-muted-foreground'
                  }`}>
                    {tx.type.toUpperCase()}
                  </span>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${
                    tx.type === 'win' || tx.type === 'deposit' ? 'text-accent' : 'text-destructive'
                  }`}>
                    {tx.type === 'win' || tx.type === 'deposit' ? '+' : '-'}{Math.abs(tx.amount)} ETB
                  </span>
                  <p className={`text-[10px] font-bold ${
                    tx.status === 'confirmed' ? 'text-accent' : tx.status === 'failed' ? 'text-destructive' : 'text-primary'
                  }`}>{tx.status}</p>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No activity yet</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Game History</h3>
            {gameHistory.map((gr: any) => (
              <div key={gr.id} className="flex items-center justify-between rounded-lg bg-card p-3">
                <div>
                  <span className={`text-xs font-bold ${gr.is_winner ? 'text-accent' : 'text-muted-foreground'}`}>
                    {gr.is_winner ? '🏆 Won' : 'Lost'} — {gr.win_pattern || 'N/A'}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Stake: {gr.games?.stake || '?'} ETB • {new Date(gr.created_at).toLocaleDateString()}
                  </p>
                </div>
                {gr.is_winner && (
                  <span className="text-sm font-bold text-accent">+{Math.floor(gr.prize_amount)} ETB</span>
                )}
              </div>
            ))}
            {gameHistory.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No games played yet</p>
            )}
          </div>
        )}

        {activeTab === 'deposits' && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Deposit History</h3>
            {deposits.map(tx => (
              <div key={tx.id} className="rounded-lg bg-card p-3">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-accent">+{tx.amount} ETB</span>
                  <span className={`text-xs font-bold ${
                    tx.status === 'confirmed' ? 'text-accent' : tx.status === 'failed' ? 'text-destructive' : 'text-primary'
                  }`}>{tx.status}</span>
                </div>
                {tx.tx_hash && <p className="mt-1 text-[10px] text-muted-foreground font-mono truncate">{tx.tx_hash}</p>}
                <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
              </div>
            ))}
            {deposits.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No deposits yet</p>
                <button onClick={onDeposit} className="mt-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground">
                  Make First Deposit
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Withdrawal History</h3>
            {withdrawals.map(tx => (
              <div key={tx.id} className="rounded-lg bg-card p-3">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-destructive">-{tx.amount} ETB</span>
                  <span className={`text-xs font-bold ${
                    tx.status === 'confirmed' ? 'text-accent' : tx.status === 'failed' ? 'text-destructive' : 'text-primary'
                  }`}>{tx.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
              </div>
            ))}
            {withdrawals.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No withdrawals yet</p>
                <button onClick={onWithdraw} className="mt-2 rounded-lg bg-secondary px-4 py-2 text-xs font-bold text-foreground">
                  Make First Withdrawal
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">🏆 Leaderboard</h3>
            {leaderboard.map((player, idx) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 rounded-lg p-3 ${
                  player.id === user.id ? 'bg-primary/20 border border-primary/30' : 'bg-card'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  idx === 0 ? 'bg-accent text-accent-foreground' :
                  idx === 1 ? 'bg-primary text-primary-foreground' :
                  idx === 2 ? 'bg-bingo-o text-primary-foreground' :
                  'bg-secondary text-foreground'
                }`}>{idx + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {player.name} {player.id === user.id && '(You)'}
                  </p>
                  <p className="text-xs text-muted-foreground">{player.total_wins} wins</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

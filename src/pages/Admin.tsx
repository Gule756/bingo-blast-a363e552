import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Users, Gamepad2, ArrowDownCircle, ArrowUpCircle, Shield } from 'lucide-react';

const ADMIN_PASSWORD = '123456';

interface Player {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  total_wins: number;
  created_at: string;
}

interface Game {
  id: string;
  stake: number;
  status: string;
  created_at: string;
  finished_at: string | null;
  win_pattern: string | null;
}

interface Transaction {
  id: string;
  player_id: string;
  player_name?: string;
  type: string;
  amount: number;
  status: string;
  wallet_address: string | null;
  tx_hash: string | null;
  created_at: string;
}

type Tab = 'players' | 'games' | 'deposits' | 'withdrawals';

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('withdrawals');
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      toast.error('Invalid password');
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [authenticated, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'players') {
        const { data } = await supabase.from('players').select('*').order('created_at', { ascending: false });
        if (data) setPlayers(data as Player[]);
      } else if (activeTab === 'games') {
        const { data } = await supabase.from('games').select('*').order('created_at', { ascending: false }).limit(100);
        if (data) setGames(data as Game[]);
      } else {
        const type = activeTab === 'deposits' ? 'deposit' : 'withdrawal';
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('type', type)
          .order('created_at', { ascending: false })
          .limit(100);

        if (txData) {
          // Get player names
          const playerIds = [...new Set(txData.map(t => t.player_id))];
          const { data: playerData } = await supabase
            .from('players')
            .select('id, name')
            .in('id', playerIds);

          const nameMap: Record<string, string> = {};
          playerData?.forEach(p => { nameMap[p.id] = p.name; });

          setTransactions(txData.map(t => ({
            ...t,
            player_name: nameMap[t.player_id] || 'Unknown',
          })) as Transaction[]);
        }
      }
    } catch (e) {
      console.error('Fetch error', e);
    }
    setLoading(false);
  };

  const handleApproveWithdrawal = async (tx: Transaction) => {
    setProcessingId(tx.id);
    try {
      // Update transaction status to confirmed
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'confirmed' })
        .eq('id', tx.id);
      if (error) throw error;
      toast.success(`Withdrawal ${tx.id.slice(0, 8)} approved`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve');
    }
    setProcessingId(null);
  };

  const handleRejectWithdrawal = async (tx: Transaction) => {
    setProcessingId(tx.id);
    try {
      // Refund: add amount back to player balance
      const { data: player } = await supabase.from('players').select('balance').eq('id', tx.player_id).single();
      if (player) {
        const newBalance = Number(player.balance) + Number(tx.amount);
        await supabase.from('players').update({ balance: newBalance }).eq('id', tx.player_id);
      }
      await supabase.from('transactions').update({ status: 'failed' }).eq('id', tx.id);
      toast.success(`Withdrawal rejected, funds refunded`);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject');
    }
    setProcessingId(null);
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-black text-foreground">Admin Panel</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin password"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleLogin}
            className="w-full rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle },
    { key: 'deposits', label: 'Deposits', icon: ArrowDownCircle },
    { key: 'players', label: 'Players', icon: Users },
    { key: 'games', label: 'Games', icon: Gamepad2 },
  ];

  const pendingWithdrawals = transactions.filter(t => t.status === 'pending');
  const completedTx = transactions.filter(t => t.status !== 'pending');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between bg-card p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-black text-foreground">Admin Dashboard</h1>
        </div>
        <button onClick={() => setAuthenticated(false)} className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive">
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 overflow-x-auto border-b border-border bg-card">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold shrink-0 transition ${
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Players */}
        {!loading && activeTab === 'players' && (
          <>
            <p className="text-xs text-muted-foreground">{players.length} players</p>
            {players.map(p => (
              <div key={p.id} className="rounded-lg bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.phone || 'No phone'} • {p.total_wins} wins</p>
                </div>
                <span className="text-sm font-bold text-accent">{p.balance} ETB</span>
              </div>
            ))}
          </>
        )}

        {/* Games */}
        {!loading && activeTab === 'games' && (
          <>
            <p className="text-xs text-muted-foreground">{games.length} games</p>
            {games.map(g => (
              <div key={g.id} className="rounded-lg bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{g.stake} ETB • {g.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(g.created_at).toLocaleString()}
                    {g.win_pattern && ` • ${g.win_pattern}`}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  g.status === 'finished' ? 'bg-accent/20 text-accent' :
                  g.status === 'playing' ? 'bg-primary/20 text-primary' :
                  'bg-secondary text-muted-foreground'
                }`}>{g.status}</span>
              </div>
            ))}
          </>
        )}

        {/* Withdrawals */}
        {!loading && activeTab === 'withdrawals' && (
          <>
            {pendingWithdrawals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-destructive">⏳ Pending Approval ({pendingWithdrawals.length})</h3>
                {pendingWithdrawals.map(tx => (
                  <div key={tx.id} className="rounded-lg bg-card p-3 border border-primary/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{tx.player_name}</p>
                        <p className="text-lg font-black text-destructive">-{tx.amount} ETB</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveWithdrawal(tx)}
                          disabled={processingId === tx.id}
                          className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground disabled:opacity-50"
                        >
                          {processingId === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRejectWithdrawal(tx)}
                          disabled={processingId === tx.id}
                          className="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {tx.wallet_address && (
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{tx.wallet_address}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">History</h3>
              {completedTx.map(tx => (
                <div key={tx.id} className="rounded-lg bg-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{tx.player_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">-{tx.amount} ETB</p>
                    <p className={`text-[10px] font-bold ${
                      tx.status === 'confirmed' ? 'text-accent' : 'text-destructive'
                    }`}>{tx.status}</p>
                  </div>
                </div>
              ))}
              {completedTx.length === 0 && pendingWithdrawals.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No withdrawals yet</p>
              )}
            </div>
          </>
        )}

        {/* Deposits */}
        {!loading && activeTab === 'deposits' && (
          <>
            <p className="text-xs text-muted-foreground">{transactions.length} deposits</p>
            {transactions.map(tx => (
              <div key={tx.id} className="rounded-lg bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{tx.player_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  {tx.tx_hash && <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">{tx.tx_hash}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-accent">+{tx.amount} ETB</p>
                  <p className={`text-[10px] font-bold ${
                    tx.status === 'confirmed' ? 'text-accent' : tx.status === 'failed' ? 'text-destructive' : 'text-primary'
                  }`}>{tx.status}</p>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No deposits yet</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

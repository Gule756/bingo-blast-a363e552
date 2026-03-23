
-- Games table: each game room with a stake level
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake integer NOT NULL CHECK (stake >= 10 AND stake <= 1000),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'countdown', 'playing', 'finished')),
  countdown_seconds integer NOT NULL DEFAULT 30 CHECK (countdown_seconds >= 10 AND countdown_seconds <= 300),
  countdown_started_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES public.players(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  winner_ids uuid[] DEFAULT '{}',
  win_pattern text,
  called_numbers integer[] DEFAULT '{}',
  max_players integer DEFAULT 200
);

-- Game players: who joined which game with which stacks
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  stack_ids integer[] NOT NULL DEFAULT '{}',
  is_eliminated boolean DEFAULT false,
  eliminated_card_ids integer[] DEFAULT '{}',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- Transactions: deposits and withdrawals
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet', 'win')),
  amount numeric(12,2) NOT NULL,
  tx_hash text,
  chain text DEFAULT 'ethereum',
  wallet_address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'confirmed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Game results: per-player outcome
CREATE TABLE public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  is_winner boolean DEFAULT false,
  prize_amount numeric(12,2) DEFAULT 0,
  win_pattern text,
  winning_card_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add balance column to players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS balance numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS total_wins integer NOT NULL DEFAULT 0;

-- RLS for games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read games" ON public.games FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated players can create games" ON public.games FOR INSERT TO public WITH CHECK (true);

-- RLS for game_players
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read game_players" ON public.game_players FOR SELECT TO public USING (true);
CREATE POLICY "Players can join games" ON public.game_players FOR INSERT TO public WITH CHECK (true);

-- RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read own transactions" ON public.transactions FOR SELECT TO public USING (true);
CREATE POLICY "Players can create transactions" ON public.transactions FOR INSERT TO public WITH CHECK (true);

-- RLS for game_results
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read game_results" ON public.game_results FOR SELECT TO public USING (true);
CREATE POLICY "System can insert results" ON public.game_results FOR INSERT TO public WITH CHECK (true);

-- Enable realtime for games and game_players
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

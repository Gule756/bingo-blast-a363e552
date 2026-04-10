-- Add tables and columns for Telegram bot functionality

-- Add transactions table for tracking deposits and withdrawals
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'transfer_in', 'transfer_out')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  payment_method TEXT,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add games_played column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;

-- Add referral system columns
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS referred_by TEXT,
ADD COLUMN IF NOT EXISTS referral_bonus_earned DECIMAL(10,2) DEFAULT 0;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_players_telegram_user_id ON players(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_players_referred_by ON players(referred_by);

-- Add function to update games played counter
CREATE OR REPLACE FUNCTION increment_games_played()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE players 
  SET games_played = games_played + 1 
  WHERE id = NEW.player_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically increment games played
DROP TRIGGER IF EXISTS trigger_increment_games_played ON games;
CREATE TRIGGER trigger_increment_games_played
AFTER INSERT ON games
FOR EACH ROW
EXECUTE FUNCTION increment_games_played();

-- Add function to handle referral bonuses
CREATE OR REPLACE FUNCTION process_referral_bonus()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id TEXT;
BEGIN
  -- Check if this player was referred
  IF NEW.referred_by IS NOT NULL THEN
    -- Add referral bonus to the referrer
    UPDATE players 
    SET 
      balance = balance + 10,
      referral_bonus_earned = referral_bonus_earned + 10
    WHERE telegram_id = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process referral bonuses on first deposit
DROP TRIGGER IF EXISTS trigger_referral_bonus ON transactions;
CREATE TRIGGER trigger_referral_bonus
AFTER UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.status = 'completed' AND NEW.type = 'deposit' AND OLD.status != 'completed')
EXECUTE FUNCTION process_referral_bonus();

-- Add RLS policies for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid()::text = (SELECT telegram_user_id::text FROM players WHERE id = player_id));

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid()::text = (SELECT telegram_user_id::text FROM players WHERE id = player_id));

-- Add comments for documentation
COMMENT ON TABLE transactions IS 'Tracks all financial transactions for players';
COMMENT ON COLUMN transactions.type IS 'Type of transaction: deposit, withdraw, transfer_in, transfer_out';
COMMENT ON COLUMN transactions.status IS 'Status of transaction: pending, completed, failed';
COMMENT ON COLUMN players.referred_by IS 'Telegram ID of the player who referred this player';
COMMENT ON COLUMN players.referral_bonus_earned IS 'Total bonus earned from referrals';

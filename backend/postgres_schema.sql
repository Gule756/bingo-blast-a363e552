-- Habesha Bingo 2.0 - PostgreSQL Database Schema
-- Compatible with aiogram 3.x and asyncpg

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Core user data
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    phone TEXT UNIQUE,
    deposited_balance DECIMAL(15,2) DEFAULT 0,
    won_balance DECIMAL(15,2) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    referrer_id BIGINT,
    welcome_bonus_given BOOLEAN DEFAULT FALSE,
    referral_count INTEGER DEFAULT 0,
    lifetime_deposits DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (referrer_id) REFERENCES users (user_id)
);

-- Deposits table - Track all deposits
CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    currency TEXT NOT NULL, -- USDT, TON, etc.
    amount DECIMAL(15,8) NOT NULL,
    etb_amount DECIMAL(15,2) NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, confirmed, failed
    tx_hash TEXT,
    confirmations INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Withdrawals table - Track all withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL, -- USDT, TON, etc.
    wallet_address TEXT NOT NULL,
    status TEXT DEFAULT 'processing', -- processing, completed, failed
    tx_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Transactions table - All financial operations
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type TEXT NOT NULL, -- welcome_bonus, referral_bonus, win, deposit, withdraw, transfer
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    room_id TEXT UNIQUE NOT NULL,
    stake_amount DECIMAL(15,2) NOT NULL,
    player_count INTEGER DEFAULT 0,
    total_pot DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'lobby', -- lobby, warning, active, finished
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Game players table
CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    user_id BIGINT NOT NULL,
    cards_selected TEXT, -- JSON array of card IDs
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (game_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    UNIQUE(game_id, user_id)
);

-- Bingo cards table
CREATE TABLE IF NOT EXISTS bingo_cards (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    card_number INTEGER NOT NULL, -- 1-400
    numbers TEXT NOT NULL, -- JSON array of 25 numbers
    is_taken BOOLEAN DEFAULT FALSE,
    taken_by_user_id BIGINT,
    taken_at TIMESTAMP WITH TIME ZONE,
    
    FOREIGN KEY (game_id) REFERENCES game_sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (taken_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    UNIQUE(game_id, card_number)
);

-- Referral tracking table
CREATE TABLE IF NOT EXISTS referral_tracking (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL,
    referred_id BIGINT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed, expired
    bonus_amount DECIMAL(15,2) DEFAULT 2.0,
    deposit_amount DECIMAL(15,2) DEFAULT 0.0, -- In USDT
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- 30 days from creation
    
    FOREIGN KEY (referrer_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users (user_id) ON DELETE CASCADE,
    UNIQUE(referrer_id, referred_id)
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_currency ON deposits(currency);
CREATE INDEX IF NOT EXISTS idx_deposits_created ON deposits(created_at);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_games_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_games_created ON game_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_gameplayers_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_gameplayers_user ON game_players(user_id);

CREATE INDEX IF NOT EXISTS idx_bingocards_game ON bingo_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_bingocards_taken ON bingo_cards(is_taken);
CREATE INDEX IF NOT EXISTS idx_bingocards_user ON bingo_cards(taken_by_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referral_tracking(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referral_tracking(status);

CREATE INDEX IF NOT EXISTS idx_config_key ON system_config(key);

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
('welcome_bonus', '10', 'Welcome bonus amount in ETB'),
('referral_bonus', '2', 'Referral bonus amount in ETB'),
('max_referrals', '20', 'Maximum number of referrals per user'),
('min_withdrawal', '100', 'Minimum withdrawal amount in ETB'),
('withdrawal_fee', '0.02', 'Withdrawal fee percentage'),
('usdt_etb_rate', '150', 'Current USDT to ETB exchange rate'),
('house_edge', '0.10', 'House edge percentage (10% = 0.10)'),
('game_lobby_duration', '30', 'Lobby duration in seconds'),
('game_warning_duration', '5', 'Warning duration in seconds'),
('number_call_interval', '3', 'Number calling interval in seconds'),
('max_cards_per_player', '3', 'Maximum cards per player'),
('min_players_per_game', '2', 'Minimum players to start game'),
('max_players_per_game', '200', 'Maximum players per game')
ON CONFLICT (key) DO NOTHING;

-- Create views for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.user_id,
    u.username,
    u.deposited_balance,
    u.won_balance,
    u.deposited_balance + u.won_balance as total_balance,
    u.referral_count,
    u.is_verified,
    u.created_at,
    u.updated_at,
    COUNT(d.id) as deposit_count,
    COALESCE(SUM(d.etb_amount), 0) as total_deposited,
    COUNT(w.id) as withdrawal_count,
    COALESCE(SUM(w.amount), 0) as total_withdrawn,
    COUNT(t.id) as transaction_count
FROM users u
LEFT JOIN deposits d ON u.user_id = d.user_id AND d.status = 'confirmed'
LEFT JOIN withdrawals w ON u.user_id = w.user_id AND w.status = 'completed'
LEFT JOIN transactions t ON u.user_id = t.user_id
GROUP BY u.user_id, u.username, u.deposited_balance, u.won_balance, u.referral_count, u.is_verified, u.created_at, u.updated_at;

-- Create view for game statistics
CREATE OR REPLACE VIEW game_stats AS
SELECT 
    g.id as game_id,
    g.room_id,
    g.stake_amount,
    g.player_count,
    g.total_pot,
    g.status,
    g.created_at,
    g.started_at,
    g.ended_at,
    CASE 
        WHEN g.ended_at IS NOT NULL AND g.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (g.ended_at - g.started_at))
        ELSE NULL 
    END as duration_seconds
FROM game_sessions g;

-- Create view for referral statistics
CREATE OR REPLACE VIEW referral_stats AS
SELECT 
    r.referrer_id,
    COUNT(*) as total_referrals,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals,
    SUM(r.bonus_amount) as total_bonus_earned,
    AVG(r.deposit_amount) as avg_deposit_amount,
    u.username as referrer_username
FROM referral_tracking r
JOIN users u ON r.referrer_id = u.user_id
GROUP BY r.referrer_id, u.username;

-- Function to update user referral count
CREATE OR REPLACE FUNCTION update_referral_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE users 
        SET referral_count = referral_count + 1 
        WHERE user_id = NEW.referrer_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_referral_count_trigger
    AFTER UPDATE ON referral_tracking
    FOR EACH ROW EXECUTE FUNCTION update_referral_count();

-- Function to update lifetime deposits
CREATE OR REPLACE FUNCTION update_lifetime_deposits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        UPDATE users 
        SET lifetime_deposits = lifetime_deposits + NEW.etb_amount 
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lifetime_deposits_trigger
    AFTER UPDATE ON deposits
    FOR EACH ROW EXECUTE FUNCTION update_lifetime_deposits();

-- Comments for documentation
COMMENT ON TABLE users IS 'Core user data including balances and verification status';
COMMENT ON TABLE deposits IS 'Cryptocurrency deposit tracking with conversion to ETB';
COMMENT ON TABLE withdrawals IS 'Withdrawal requests and processing status';
COMMENT ON TABLE transactions IS 'All financial transactions for audit trail';
COMMENT ON TABLE game_sessions IS 'Bingo game session tracking';
COMMENT ON TABLE game_players IS 'Player participation in games';
COMMENT ON TABLE bingo_cards IS 'Bingo card data for each game';
COMMENT ON TABLE referral_tracking IS 'Detailed referral tracking with bonuses';
COMMENT ON TABLE system_config IS 'System configuration parameters';

-- Sample data for testing (optional)
-- INSERT INTO users (user_id, username, deposited_balance, won_balance, is_verified)
-- VALUES (123456789, 'testuser', 10.0, 5.0, TRUE)
-- ON CONFLICT (user_id) DO NOTHING;

-- Habesha Bingo 2.0 Database Schema
-- PostgreSQL migration script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id INTEGER UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    username VARCHAR(50) UNIQUE,
    
    -- Balances
    won_balance DECIMAL(15,2) DEFAULT 0.0,  -- Withdrawable
    deposited_balance DECIMAL(15,2) DEFAULT 0.0,  -- Play only (deposits + bonuses)
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    god_mode BOOLEAN DEFAULT FALSE,  -- For Gule test account
    
    -- Referral system
    referrer_id UUID REFERENCES users(id),
    referral_count INTEGER DEFAULT 0,
    welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction details
    type VARCHAR(50) NOT NULL,  -- deposit, withdraw, win, welcome_bonus, referral_bonus
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
    status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, failed
    
    -- Crypto details
    crypto_currency VARCHAR(10),  -- USDT, TON
    crypto_address TEXT,
    tx_hash TEXT,
    confirmations INTEGER DEFAULT 0,
    
    -- Metadata
    description TEXT,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(50) UNIQUE NOT NULL,
    
    -- Game configuration
    stake_amount DECIMAL(15,2) NOT NULL,
    max_players INTEGER DEFAULT 200,
    house_edge DECIMAL(3,2) DEFAULT 0.10,  -- 10%
    
    -- Game state
    state VARCHAR(20) DEFAULT 'lobby',  -- lobby, warning, active, finished
    current_number INTEGER,
    called_numbers INTEGER[],
    
    -- Timing
    lobby_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lobby_end TIMESTAMP WITH TIME ZONE,
    game_start TIMESTAMP WITH TIME ZONE,
    game_end TIMESTAMP WITH TIME ZONE,
    
    -- Winner
    winner_id UUID REFERENCES users(id),
    winning_pattern VARCHAR(50),  -- horizontal, vertical, diagonal, corners, full_house
    winning_cards INTEGER[],
    
    -- Pot
    total_pot DECIMAL(15,2) DEFAULT 0.0,
    house_cut DECIMAL(15,2) DEFAULT 0.0,
    
    -- System bot (dummy player)
    is_system_winner BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game players table
CREATE TABLE IF NOT EXISTS game_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Player state
    cards_selected INTEGER[],
    is_active BOOLEAN DEFAULT TRUE,
    final_position INTEGER,  -- 1st, 2nd, 3rd, etc.
    
    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(game_id, user_id)
);

-- Bingo cards table
CREATE TABLE IF NOT EXISTS bingo_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    card_number INTEGER NOT NULL,  -- 1-400
    
    -- Card data (5x5 grid with B-I-N-G-O columns)
    numbers INTEGER[25] NOT NULL,  -- 25 numbers, 0 for FREE space
    is_taken BOOLEAN DEFAULT FALSE,
    taken_by_user_id UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    taken_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(game_id, card_number)
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, completed, expired
    bonus_paid BOOLEAN DEFAULT FALSE,
    bonus_amount DECIMAL(15,2) DEFAULT 2.0,  -- 2 ETB per referral
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(referrer_id, referred_id)
);

-- System config table
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_games_state ON games(state);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);

CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);

CREATE INDEX IF NOT EXISTS idx_bingo_cards_game_id ON bingo_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_cards_taken_by ON bingo_cards(taken_by_user_id);
CREATE INDEX IF NOT EXISTS idx_bingo_cards_is_taken ON bingo_cards(is_taken);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
('welcome_bonus', '10', 'Welcome bonus amount in ETB'),
('referral_bonus', '2', 'Referral bonus amount in ETB'),
('max_referrals', '20', 'Maximum number of referrals per user'),
('min_withdrawal', '100', 'Minimum withdrawal amount in ETB'),
('house_edge', '0.10', 'House edge percentage (10% = 0.10)'),
('game_lobby_duration', '30', 'Lobby duration in seconds'),
('game_warning_duration', '5', 'Warning duration in seconds'),
('number_call_interval', '3', 'Number calling interval in seconds'),
('system_bot_win_chance', '0.10', 'Chance for system bot to win (10% = 0.10)')
ON CONFLICT (key) DO NOTHING;

-- Create Gule test account (if ID is set)
-- This will be handled by the application logic when Gule's Telegram ID is known

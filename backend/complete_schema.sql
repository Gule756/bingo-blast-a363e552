-- Habesha Bingo 2.0 - Complete Database Schema
-- Based on the complete logic blueprint

-- Enable necessary extensions
PRAGMA foreign_keys = ON;

-- Users table - Core user data
CREATE TABLE IF NOT EXISTS Users (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    phone_number TEXT UNIQUE,
    deposited_balance DECIMAL(15,2) DEFAULT 0,
    won_balance DECIMAL(15,2) DEFAULT 0,
    bonus_claimed BOOLEAN DEFAULT FALSE,
    referral_count INT DEFAULT 0,
    referrer_id BIGINT,
    is_verified BOOLEAN DEFAULT FALSE,
    lifetime_deposits DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_state TEXT DEFAULT NULL,
    
    FOREIGN KEY (referrer_id) REFERENCES Users (user_id)
);

-- Deposits table - Crypto deposit tracking
CREATE TABLE IF NOT EXISTS Deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id BIGINT NOT NULL,
    currency TEXT NOT NULL,  -- USDT, TON, BTC
    amount DECIMAL(15,8) NOT NULL,
    etb_amount DECIMAL(15,2) NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, confirmed, failed
    tx_hash TEXT,
    confirmations INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
);

-- Withdrawals table - Withdrawal tracking
CREATE TABLE IF NOT EXISTS Withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL,  -- USDT, TON
    wallet_address TEXT NOT NULL,
    status TEXT DEFAULT 'processing',  -- processing, completed, failed
    tx_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
);

-- Transactions table - All financial operations
CREATE TABLE IF NOT EXISTS Transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id BIGINT NOT NULL,
    type TEXT NOT NULL,  -- welcome_bonus, referral_bonus, win, deposit, withdraw, transfer
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
);

-- GameSessions table - Bingo game tracking
CREATE TABLE IF NOT EXISTS GameSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT UNIQUE NOT NULL,
    stake_amount DECIMAL(15,2) NOT NULL,
    player_count INTEGER DEFAULT 0,
    total_pot DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'lobby',  -- lobby, warning, active, finished
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- GamePlayers table - Player participation in games
CREATE TABLE IF NOT EXISTS GamePlayers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id BIGINT NOT NULL,
    cards_selected TEXT,  -- JSON array of card IDs
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES GameSessions (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE,
    UNIQUE(game_id, user_id)
);

-- BingoCards table - Card data for games
CREATE TABLE IF NOT EXISTS BingoCards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    card_number INTEGER NOT NULL,  -- 1-400
    numbers TEXT NOT NULL,  -- JSON array of 25 numbers
    is_taken BOOLEAN DEFAULT FALSE,
    taken_by_user_id BIGINT,
    taken_at TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES GameSessions (id) ON DELETE CASCADE,
    FOREIGN KEY (taken_by_user_id) REFERENCES Users (user_id) ON DELETE SET NULL,
    UNIQUE(game_id, card_number)
);

-- ReferralTracking table - Detailed referral tracking
CREATE TABLE IF NOT EXISTS ReferralTracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id BIGINT NOT NULL,
    referred_id BIGINT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, completed, expired
    base_bonus DECIMAL(15,2) DEFAULT 2.0,
    crypto_bonus DECIMAL(15,2) DEFAULT 0.0,
    total_bonus DECIMAL(15,2) DEFAULT 2.0,
    deposit_amount DECIMAL(15,2) DEFAULT 0.0,  -- In USDT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,  -- 30 days from creation
    
    FOREIGN KEY (referrer_id) REFERENCES Users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES Users (user_id) ON DELETE CASCADE,
    UNIQUE(referrer_id, referred_id)
);

-- SystemConfig table - System configuration
CREATE TABLE IF NOT EXISTS SystemConfig (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AdminLogs table - Admin action logging
CREATE TABLE IF NOT EXISTS AdminLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_id) REFERENCES Users (user_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON Users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON Users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_verified ON Users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_created ON Users(created_at);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON Deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON Deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_currency ON Deposits(currency);
CREATE INDEX IF NOT EXISTS idx_deposits_created ON Deposits(created_at);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON Withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON Withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON Withdrawals(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON Transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON Transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON Transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_games_status ON GameSessions(status);
CREATE INDEX IF NOT EXISTS idx_games_created ON GameSessions(created_at);

CREATE INDEX IF NOT EXISTS idx_gameplayers_game ON GamePlayers(game_id);
CREATE INDEX IF NOT EXISTS idx_gameplayers_user ON GamePlayers(user_id);

CREATE INDEX IF NOT EXISTS idx_bingocards_game ON BingoCards(game_id);
CREATE INDEX IF NOT EXISTS idx_bingocards_taken ON BingoCards(is_taken);
CREATE INDEX IF NOT EXISTS idx_bingocards_user ON BingoCards(taken_by_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON ReferralTracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON ReferralTracking(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON ReferralTracking(status);

CREATE INDEX IF NOT EXISTS idx_config_key ON SystemConfig(key);

-- Insert default system configuration
INSERT OR IGNORE INTO SystemConfig (key, value, description) VALUES
('welcome_bonus', '10', 'Welcome bonus amount in ETB'),
('referral_bonus', '2', 'Referral bonus amount in ETB'),
('crypto_referral_bonus', '5', 'Extra referral bonus for deposits > $5'),
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
('max_players_per_game', '200', 'Maximum players per game');

-- Create triggers for automatic updates
CREATE TRIGGER IF NOT EXISTS update_users_last_active 
    AFTER UPDATE ON Users
    BEGIN
        UPDATE Users SET last_active = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_deposits_updated_at 
    AFTER UPDATE ON Deposits
    BEGIN
        UPDATE Deposits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_withdrawals_updated_at 
    AFTER UPDATE ON Withdrawals
    BEGIN
        UPDATE Withdrawals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_config_updated_at 
    AFTER UPDATE ON SystemConfig
    BEGIN
        UPDATE SystemConfig SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;

-- Create view for user statistics
CREATE VIEW IF NOT EXISTS UserStats AS
SELECT 
    u.user_id,
    u.username,
    u.deposited_balance,
    u.won_balance,
    u.deposited_balance + u.won_balance as total_balance,
    u.referral_count,
    u.is_verified,
    u.created_at,
    u.last_active,
    COUNT(d.id) as deposit_count,
    COALESCE(SUM(d.etb_amount), 0) as total_deposited,
    COUNT(w.id) as withdrawal_count,
    COALESCE(SUM(w.amount), 0) as total_withdrawn,
    COUNT(t.id) as transaction_count
FROM Users u
LEFT JOIN Deposits d ON u.user_id = d.user_id AND d.status = 'confirmed'
LEFT JOIN Withdrawals w ON u.user_id = w.user_id AND w.status = 'completed'
LEFT JOIN Transactions t ON u.user_id = t.user_id
GROUP BY u.user_id;

-- Create view for game statistics
CREATE VIEW IF NOT EXISTS GameStats AS
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
        THEN (julianday(g.ended_at) - julianday(g.started_at)) * 24 * 60 * 60
        ELSE NULL 
    END as duration_seconds
FROM GameSessions g;

-- Create view for referral statistics
CREATE VIEW IF NOT EXISTS ReferralStats AS
SELECT 
    r.referrer_id,
    COUNT(*) as total_referrals,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_referrals,
    SUM(r.total_bonus) as total_bonus_earned,
    AVG(r.deposit_amount) as avg_deposit_amount,
    u.username as referrer_username
FROM ReferralTracking r
JOIN Users u ON r.referrer_id = u.user_id
GROUP BY r.referrer_id, u.username;

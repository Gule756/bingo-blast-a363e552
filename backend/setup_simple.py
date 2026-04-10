#!/usr/bin/env python3
"""
Simple setup script for Habesha Bingo Bot
"""

import sqlite3
import os
from dotenv import load_dotenv

def setup_environment():
    """Setup environment and database"""
    print("Setting up Habesha Bingo Bot...")
    
    # Create .env file if it doesn't exist
    if not os.path.exists('.env'):
        print("Creating .env file...")
        with open('.env', 'w') as f:
            f.write("""# Habesha Bingo Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
GULE_TEST_ID=123456789
""")
        print("Please edit .env file with your bot token and Gule's Telegram ID")
        return False
    
    # Load environment
    load_dotenv()
    
    # Check bot token
    bot_token = os.getenv('BOT_TOKEN')
    if not bot_token or bot_token == 'YOUR_BOT_TOKEN_HERE':
        print("Please set your BOT_TOKEN in .env file")
        return False
    
    # Initialize database
    print("Initializing database...")
    conn = sqlite3.connect('habesha_bingo.db')
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            phone TEXT UNIQUE,
            first_name TEXT NOT NULL,
            last_name TEXT,
            username TEXT,
            won_balance REAL DEFAULT 0.0,
            deposited_balance REAL DEFAULT 0.0,
            is_verified BOOLEAN DEFAULT 0,
            god_mode BOOLEAN DEFAULT 0,
            referral_count INTEGER DEFAULT 0,
            welcome_bonus_claimed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER NOT NULL,
            referred_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            bonus_paid BOOLEAN DEFAULT 0,
            bonus_amount REAL DEFAULT 2.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users (id),
            FOREIGN KEY (referred_id) REFERENCES users (id)
        )
    """)
    
    conn.commit()
    conn.close()
    
    print("Database initialized successfully!")
    print("Setup complete! You can now run: python simple_bot.py")
    return True

if __name__ == "__main__":
    setup_environment()

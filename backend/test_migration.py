#!/usr/bin/env python3
"""
Quick test script to verify migration setup
"""

import os
import sqlite3
from datetime import datetime

def test_sqlite_setup():
    """Create test data in SQLite for migration testing"""
    print("Setting up test SQLite data...")
    
    # Connect to SQLite
    conn = sqlite3.connect('habesha_bingo_complete.db')
    cursor = conn.cursor()
    
    # Create tables if they don't exist
    cursor.execute("""
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
            current_state TEXT DEFAULT NULL
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id BIGINT NOT NULL,
            type TEXT NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Insert test users
    test_users = [
        (123456789, "TestUser1", "+251911000001", 50.0, 25.0, 1, 2, None, 1, 100.0),
        (987654321, "TestUser2", "+251922000002", 0.0, 10.0, 0, 0, 123456789, 0, 0.0),
        (555666777, "TestUser3", None, 15.0, 5.0, 1, 1, None, 1, 25.0)
    ]
    
    for user in test_users:
        cursor.execute("""
            INSERT OR REPLACE INTO Users 
            (user_id, username, phone_number, deposited_balance, won_balance, 
             bonus_claimed, referral_count, referrer_id, is_verified, lifetime_deposits)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, user)
    
    # Insert test transactions
    test_transactions = [
        (123456789, "welcome_bonus", 10.0, "Welcome bonus", "completed"),
        (123456789, "deposit", 50.0, "Crypto deposit", "completed"),
        (123456789, "win", 25.0, "Game winnings", "completed"),
        (987654321, "welcome_bonus", 10.0, "Welcome bonus", "completed"),
        (555666777, "deposit", 15.0, "Crypto deposit", "completed"),
        (555666777, "win", 5.0, "Game winnings", "completed")
    ]
    
    for tx in test_transactions:
        cursor.execute("""
            INSERT OR REPLACE INTO Transactions 
            (user_id, type, amount, description, status)
            VALUES (?, ?, ?, ?, ?)
        """, tx)
    
    conn.commit()
    
    # Verify data
    cursor.execute("SELECT COUNT(*) FROM Users")
    user_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM Transactions")
    tx_count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"Test data created:")
    print(f"- Users: {user_count}")
    print(f"- Transactions: {tx_count}")
    
    return user_count > 0

def check_environment():
    """Check if environment variables are set"""
    print("Checking environment...")
    
    required_vars = ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN']
    missing = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print(f"Missing environment variables: {', '.join(missing)}")
        print("Please set these in your .env file")
        return False
    
    print("Environment variables OK!")
    return True

def main():
    print("Migration Test Setup")
    print("=" * 40)
    
    # Check environment
    if not check_environment():
        return
    
    # Setup test data
    if test_sqlite_setup():
        print("\nTest setup complete!")
        print("You can now run: python migrate_to_supabase.py")
    else:
        print("\nTest setup failed!")

if __name__ == "__main__":
    main()

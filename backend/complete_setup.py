#!/usr/bin/env python3
"""
Complete Setup Script for Habesha Bingo 2.0
Based on the complete logic blueprint
"""

import sqlite3
import os
from dotenv import load_dotenv

def setup_complete_environment():
    """Setup complete environment and database"""
    print("Setting up Habesha Bingo 2.0 - Complete Version...")
    print("=" * 50)
    
    # Create .env file if it doesn't exist
    if not os.path.exists('.env'):
        print("Creating .env file...")
        with open('.env', 'w') as f:
            f.write("""# Habesha Bingo 2.0 - Complete Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
GULE_ID=123456789
CURRENT_USDT_ETB_RATE=150
MINI_APP_URL=https://bingo-blast-a363e552.vercel.app
SECRET_KEY=your-secret-key-here
""")
        print("Please edit .env file with your configuration:")
        print("- BOT_TOKEN: Get from @BotFather")
        print("- GULE_ID: Your Telegram ID for admin access")
        print("- CURRENT_USDT_ETB_RATE: Current market rate (150)")
        print("- MINI_APP_URL: Your Mini App URL")
        print("- SECRET_KEY: Secret key for authentication")
        return False
    
    # Load environment
    load_dotenv()
    
    # Check required environment variables
    required_vars = ['BOT_TOKEN', 'GULE_ID', 'CURRENT_USDT_ETB_RATE', 'MINI_APP_URL']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var) or os.getenv(var) == f"YOUR_{var}_HERE" or os.getenv(var) == "123456789":
            missing_vars.append(var)
    
    if missing_vars:
        print(f"Missing environment variables: {', '.join(missing_vars)}")
        print("Please edit .env file and set all required variables")
        return False
    
    # Initialize database
    print("Initializing complete database...")
    
    try:
        conn = sqlite3.connect('habesha_bingo_complete.db')
        cursor = conn.cursor()
        
        # Read and execute schema
        with open('complete_schema.sql', 'r') as f:
            schema_sql = f.read()
        
        cursor.executescript(schema_sql)
        conn.commit()
        
        print("Database initialized successfully!")
        
        # Create Gule test account if ID is set
        gule_id = int(os.getenv('GULE_ID'))
        cursor.execute("""
            INSERT OR IGNORE INTO Users 
            (user_id, username, deposited_balance, won_balance, is_verified, bonus_claimed)
            VALUES (?, 'Gule', 1000000, 0, 1, 1)
        """, (gule_id,))
        
        conn.commit()
        conn.close()
        
        print("Gule test account created with 1,000,000 ETB balance!")
        
    except Exception as e:
        print(f"Database initialization failed: {e}")
        return False
    
    print("\nSetup complete! You can now run: python complete_bot.py")
    return True

def test_database_connection():
    """Test database connection and basic operations"""
    print("Testing database connection...")
    
    try:
        conn = sqlite3.connect('habesha_bingo_complete.db')
        cursor = conn.cursor()
        
        # Test basic queries
        cursor.execute("SELECT COUNT(*) FROM Users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM SystemConfig")
        config_count = cursor.fetchone()[0]
        
        print(f"Database connected successfully!")
        print(f"Users table: {user_count} records")
        print(f"SystemConfig table: {config_count} records")
        
        # Test user creation
        cursor.execute("""
            INSERT OR IGNORE INTO Users 
            (user_id, username, deposited_balance, won_balance, is_verified)
            VALUES (?, 'TestUser', 10.0, 5.0, 1)
        """, (999999,))
        
        # Test transaction creation
        cursor.execute("""
            INSERT OR IGNORE INTO Transactions 
            (user_id, type, amount, description)
            VALUES (?, 'test', 10.0, 'Test transaction')
        """, (999999,))
        
        conn.commit()
        
        # Verify data
        cursor.execute("SELECT * FROM Users WHERE user_id = ?", (999999,))
        user = cursor.fetchone()
        
        if user:
            print(f"Test user created: {user[1]} with balance {user[3] + user[4]} ETB")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"Database test failed: {e}")
        return False

def show_command_summary():
    """Show summary of all implemented commands"""
    print("\n" + "=" * 50)
    print("IMPLEMENTED COMMANDS")
    print("=" * 50)
    
    commands = [
        ("/start", "Entry gate - user registration and verification"),
        ("/register", "Bonus & verification - triggered by contact sharing"),
        ("/balance", "The ledger - show balance breakdown"),
        ("/invite", "Growth engine - referral system"),
        ("/deposit", "Crypto inflow - multi-currency deposits"),
        ("/withdraw", "Cash out - with 50% rule validation"),
        ("/play", "Launch Mini App - with authentication"),
        ("/instructions", "The rulebook - Amharic game rules"),
        ("/transfer", "Internal move - winnings to play balance"),
        ("/cancel", "State reset - cancel active processes"),
        ("/admin_panel", "God mode - admin commands (Gule only)")
    ]
    
    for cmd, desc in commands:
        print(f"{cmd:<12} - {desc}")
    
    print("\n" + "=" * 50)
    print("DATABASE TABLES")
    print("=" * 50)
    
    tables = [
        ("Users", "Core user data and balances"),
        ("Deposits", "Crypto deposit tracking"),
        ("Withdrawals", "Withdrawal tracking"),
        ("Transactions", "All financial operations"),
        ("GameSessions", "Bingo game tracking"),
        ("GamePlayers", "Player participation"),
        ("BingoCards", "Card data for games"),
        ("ReferralTracking", "Detailed referral tracking"),
        ("SystemConfig", "System configuration"),
        ("AdminLogs", "Admin action logging")
    ]
    
    for table, desc in tables:
        print(f"{table:<17} - {desc}")
    
    print("\n" + "=" * 50)
    print("SPECIAL FEATURES")
    print("=" * 50)
    
    features = [
        ("Gule Test Account", "1,000,000 ETB balance + God Mode"),
        ("50% Withdrawal Rule", "Must deposit 50% of winnings"),
        ("Referral System", "2 ETB per referral, max 20"),
        ("Crypto Integration", "USDT, TON support with live rates"),
        ("Mini App Auth", "Secure WebApp authentication"),
        ("Admin Panel", "Broadcast, pause game, update rates"),
        ("State Management", "Cancel active operations"),
        ("Complete Logging", "All actions tracked")
    ]
    
    for feature, desc in features:
        print(f"{feature:<20} - {desc}")

def main():
    """Main setup function"""
    print("Habesha Bingo 2.0 - Complete Setup")
    print("Based on the complete logic blueprint")
    print()
    
    # Setup environment
    if not setup_complete_environment():
        print("\nSetup failed. Please fix the issues above and try again.")
        return
    
    # Test database
    if not test_database_connection():
        print("\nDatabase test failed. Please check your setup.")
        return
    
    # Show command summary
    show_command_summary()
    
    print("\n" + "=" * 50)
    print("SETUP COMPLETE!")
    print("=" * 50)
    print("Your Habesha Bingo 2.0 bot is ready to run!")
    print()
    print("Next steps:")
    print("1. Test the bot: python complete_bot.py")
    print("2. Send /start to your bot in Telegram")
    print("3. Verify all commands work correctly")
    print("4. Test Gule admin panel with your ID")
    print("5. Deploy to production when ready")
    print()
    print("Good luck! fire")

if __name__ == "__main__":
    main()

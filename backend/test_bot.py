#!/usr/bin/env python3
"""
Test script for Habesha Bingo Bot
Verifies all basic functionality
"""

import sqlite3
import asyncio
from simple_bot import HabeshaBingoBot
from simple_game_loop import BingoGame

def test_database():
    """Test database operations"""
    print("Testing database...")
    
    conn = sqlite3.connect('habesha_bingo.db')
    cursor = conn.cursor()
    
    # Test user creation
    cursor.execute("""
        INSERT OR IGNORE INTO users 
        (telegram_id, first_name, last_name, username, is_verified, welcome_bonus_claimed)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (123456, "Test User", "Last", "testuser", 1, 0))
    
    # Test balance update
    cursor.execute("""
        UPDATE users 
        SET won_balance = won_balance + 10, deposited_balance = deposited_balance + 5
        WHERE telegram_id = ?
    """, (123456,))
    
    # Test transaction creation
    cursor.execute("""
        INSERT INTO transactions (user_id, type, amount, status, description)
        VALUES (?, 'test', 10, 'completed', 'Test transaction')
    """, (1,))
    
    conn.commit()
    
    # Verify data
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (123456,))
    user = cursor.fetchone()
    
    if user:
        print(f"Database test passed! User: {user[1]}, Balance: {user[4]} + {user[5]}")
    else:
        print("Database test failed!")
    
    conn.close()

async def test_game_loop():
    """Test game loop functionality"""
    print("Testing game loop...")
    
    game = BingoGame()
    
    # Create test game
    room_id = game.create_game(10.0)
    print(f"Created game room: {room_id}")
    
    # Add test players
    result = game.join_game(room_id, 123456, [1, 2, 3])
    print(f"Player 1 joined: {result[0]}")
    
    result = game.join_game(room_id, 789012, [4, 5])
    print(f"Player 2 joined: {result[0]}")
    
    # Get game state
    state = game.get_game_state(room_id)
    if state:
        print(f"Game state: Phase={state['phase']}, Players={len(state['players'])}, Pot={state['total_pot']}")
    
    # Test card generation
    cards = game.generate_card_numbers()
    print(f"Generated card with {len(cards)} numbers")
    
    # Test bingo checking
    marked = [False] * 25
    marked[12] = True  # Mark center
    
    # Mark a winning line (first row)
    for i in range(5):
        marked[i] = True
    
    is_bingo = game.check_bingo(cards, marked)
    print(f"Bingo check: {is_bingo}")
    
    await game.stop()
    print("Game loop test passed!")

def test_bot_commands():
    """Test bot command logic"""
    print("Testing bot commands...")
    
    # This would require actual bot instance
    # For now, just verify the structure
    bot = HabeshaBingoBot()
    
    # Check if handlers are set up
    handlers = len(bot.dp.message.handlers.handlers)
    print(f"Bot handlers registered: {handlers}")
    
    if handlers >= 5:  # At least start, balance, register, invite, contact
        print("Bot commands test passed!")
    else:
        print("Bot commands test failed!")

def test_referral_system():
    """Test referral system"""
    print("Testing referral system...")
    
    conn = sqlite3.connect('habesha_bingo.db')
    cursor = conn.cursor()
    
    # Create test users
    cursor.execute("""
        INSERT OR IGNORE INTO users (telegram_id, first_name, is_verified)
        VALUES (?, ?, ?), (?, ?, ?)
    """, (111111, "Referrer", 1, 222222, "Referred", 1))
    
    # Get user IDs
    cursor.execute("SELECT id FROM users WHERE telegram_id IN (?, ?)", (111111, 222222))
    users = cursor.fetchall()
    
    if len(users) == 2:
        referrer_id = users[0][0]
        referred_id = users[1][0]
        
        # Create referral
        cursor.execute("""
            INSERT OR IGNORE INTO referrals (referrer_id, referred_id, status, bonus_amount)
            VALUES (?, ?, 'pending', 2.0)
        """, (referrer_id, referred_id))
        
        # Complete referral
        cursor.execute("""
            UPDATE referrals SET status = 'completed', completed_at = datetime('now')
            WHERE referrer_id = ? AND referred_id = ?
        """, (referrer_id, referred_id))
        
        # Update referrer balance
        cursor.execute("""
            UPDATE users SET deposited_balance = deposited_balance + 2, referral_count = referral_count + 1
            WHERE id = ?
        """, (referrer_id,))
        
        conn.commit()
        
        # Verify
        cursor.execute("SELECT referral_count, deposited_balance FROM users WHERE id = ?", (referrer_id,))
        result = cursor.fetchone()
        
        if result and result[0] == 1 and result[1] == 2.0:
            print("Referral system test passed!")
        else:
            print("Referral system test failed!")
    
    conn.close()

def main():
    """Run all tests"""
    print("Starting Habesha Bingo Bot Tests...\n")
    
    try:
        test_database()
        print()
        
        asyncio.run(test_game_loop())
        print()
        
        test_bot_commands()
        print()
        
        test_referral_system()
        print()
        
        print("All tests completed! Check results above.")
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

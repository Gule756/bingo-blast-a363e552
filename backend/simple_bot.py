#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - Simple Bot Boilerplate
Focused implementation with /start and /balance commands
"""

import asyncio
import logging
from datetime import datetime
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
import sqlite3
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot Configuration
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"  # Replace with your actual token
GULE_TEST_ID = 123456789  # Replace with Gule's actual Telegram ID

# Database setup
DB_NAME = "habesha_bingo.db"

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db_cursor():
    """Context manager for database operations"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_database():
    """Initialize database with required tables"""
    with get_db_cursor() as cursor:
        # Users table
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
        
        # Transactions table
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
        
        # Referrals table
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
        
        logger.info("Database initialized successfully")

class HabeshaBingoBot:
    def __init__(self):
        self.bot = Bot(token=BOT_TOKEN)
        self.dp = Dispatcher()
        self.setup_handlers()
        init_database()

    def setup_handlers(self):
        """Setup bot command handlers"""
        
        @self.dp.message(Command("start"))
        async def cmd_start(message: types.Message):
            await self.handle_start(message)
        
        @self.dp.message(Command("balance"))
        async def cmd_balance(message: types.Message):
            await self.handle_balance(message)
        
        @self.dp.message(Command("register"))
        async def cmd_register(message: types.Message):
            await self.handle_register(message)
        
        @self.dp.message(Command("invite"))
        async def cmd_invite(message: types.Message):
            await self.handle_invite(message)
        
        @self.dp.message(F.contact)
        async def handle_contact(message: types.Message):
            await self.handle_contact_verification(message)
        
        @self.dp.message()
        async def handle_unknown(message: types.Message):
            await self.handle_unknown_command(message)

    async def handle_start(self, message: types.Message):
        """Handle /start command"""
        user_id = message.from_user.id
        first_name = message.from_user.first_name
        last_name = message.from_user.last_name or ""
        username = message.from_user.username
        
        # Parse start parameters for referrals
        args = message.text.split()[1:] if len(message.text.split()) > 1 else []
        referral_code = None
        
        if args and args[0].startswith("REF_"):
            referral_code = args[0][4:]
        
        with get_db_cursor() as cursor:
            # Check if user exists
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                # New user - create record
                cursor.execute("""
                    INSERT INTO users 
                    (telegram_id, first_name, last_name, username) 
                    VALUES (?, ?, ?, ?)
                """, (user_id, first_name, last_name, username))
                
                user_id_db = cursor.lastrowid
                
                # Handle Gule test account
                if user_id == GULE_TEST_ID:
                    cursor.execute("""
                        UPDATE users 
                        SET god_mode = 1, won_balance = 1000000 
                        WHERE telegram_id = ?
                    """, (user_id,))
                
                welcome_text = (
                    "Welcome to Habesha Bingo 2.0! \n\n"
                    "Play multiplayer Bingo with real ETB prizes!\n\n"
                    "First, verify your phone number to get started:\n"
                    "Get 10 ETB welcome bonus! \n"
                )
                
                keyboard = ReplyKeyboardMarkup(
                    keyboard=[[KeyboardButton(text="Share Contact", request_contact=True)]],
                    resize_keyboard=True,
                    one_time_keyboard=True
                )
                
                await message.answer(welcome_text, reply_markup=keyboard)
                
            elif not user['is_verified']:
                # User exists but not verified
                keyboard = ReplyKeyboardMarkup(
                    keyboard=[[KeyboardButton(text="Share Contact", request_contact=True)]],
                    resize_keyboard=True,
                    one_time_keyboard=True
                )
                
                await message.answer(
                    f"Hi {user['first_name']}! Please verify your phone number to continue:",
                    reply_markup=keyboard
                )
                
            else:
                # Existing verified user - show main menu
                await self.show_main_menu(message, user)

    async def handle_register(self, message: types.Message):
        """Handle /register command"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await message.answer("Please use /start to register first.")
                return
            
            if user['is_verified']:
                await message.answer("You're already registered! Use /balance to check your account.")
            else:
                keyboard = ReplyKeyboardMarkup(
                    keyboard=[[KeyboardButton(text="Share Contact", request_contact=True)]],
                    resize_keyboard=True,
                    one_time_keyboard=True
                )
                
                await message.answer(
                    "Please share your contact to complete registration:",
                    reply_markup=keyboard
                )

    async def handle_balance(self, message: types.Message):
        """Handle /balance command"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer("Please register first using /start")
                return
            
            total_balance = user['won_balance'] + user['deposited_balance']
            
            # Get recent transactions
            cursor.execute("""
                SELECT type, amount, status, created_at 
                FROM transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            """, (user['id'],))
            transactions = cursor.fetchall()
            
            text = (
                f"Your Balance Information\n\n"
                f"Total Balance: {total_balance} ETB\n"
                f"Won Balance: {user['won_balance']} ETB (Withdrawable)\n"
                f"Deposited Balance: {user['deposited_balance']} ETB (Play Only)\n\n"
            )
            
            if transactions:
                text += "Recent Transactions:\n"
                for tx in transactions:
                    symbol = "+" if tx['type'] in ["deposit", "win", "welcome_bonus", "referral_bonus"] else "-"
                    text += f"{symbol}{tx['amount']} ETB - {tx['type'].replace('_', ' ').title()}\n"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="View Transactions", callback_data="tx_history")],
                [InlineKeyboardButton(text="Play Bingo", callback_data="play_bingo")]
            ])
            
            await message.answer(text, reply_markup=keyboard)

    async def handle_invite(self, message: types.Message):
        """Handle /invite command"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer("Please register first using /start")
                return
            
            # Generate referral link
            bot_username = (await self.bot.get_me()).username
            referral_link = f"https://t.me/{bot_username}?start=REF_{user_id}"
            
            # Get referral stats
            cursor.execute("""
                SELECT r.*, u.first_name 
                FROM referrals r
                JOIN users u ON r.referred_id = u.id
                WHERE r.referrer_id = ?
                ORDER BY r.created_at DESC
            """, (user['id'],))
            referrals = cursor.fetchall()
            
            completed_referrals = [r for r in referrals if r['status'] == 'completed']
            max_referrals = 20
            progress = len(completed_referrals)
            
            text = (
                f"Invite Friends & Earn 2 ETB Each!\n\n"
                f"Your referral link:\n{referral_link}\n\n"
                f"Progress: {progress}/{max_referrals} referrals\n"
                f"Bonus earned: {len(completed_referrals) * 2} ETB\n\n"
            )
            
            if progress >= max_referrals:
                text += "You've reached the maximum referral limit!"
            else:
                text += f"You can earn {2 * (max_referrals - progress)} more ETB from referrals!"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="Share Link", url=referral_link)],
                [InlineKeyboardButton(text="View Referrals", callback_data="view_referrals")]
            ])
            
            await message.answer(text, reply_markup=keyboard)

    async def handle_contact_verification(self, message: types.Message):
        """Handle contact sharing for verification"""
        user_id = message.from_user.id
        contact = message.contact
        
        # Verify contact belongs to user
        if contact.user_id != user_id:
            await message.answer("Security alert: Contact doesn't match your account.")
            return
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await message.answer("Please use /start first.")
                return
            
            # Check if phone already exists
            cursor.execute("SELECT * FROM users WHERE phone = ? AND telegram_id != ?", 
                         (contact.phone_number, user_id))
            existing_user = cursor.fetchone()
            
            if existing_user:
                await message.answer("This phone number is already registered with another account.")
                return
            
            # Update user
            cursor.execute("""
                UPDATE users 
                SET phone = ?, is_verified = 1 
                WHERE telegram_id = ?
            """, (contact.phone_number, user_id))
            
            # Give welcome bonus if not already claimed
            if not user['welcome_bonus_claimed']:
                cursor.execute("""
                    UPDATE users 
                    SET deposited_balance = deposited_balance + 10, 
                        welcome_bonus_claimed = 1 
                    WHERE telegram_id = ?
                """, (user_id,))
                
                # Create transaction record
                cursor.execute("""
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'welcome_bonus', 10, 'completed', 'Welcome bonus')
                """, (user['id'],))
            
            # Show success message
            keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
            await message.answer(
                "Verification successful! \n"
                f"Welcome bonus: 10 ETB credited!\n"
                f"Your balance: {user['won_balance'] + user['deposited_balance'] + (10 if not user['welcome_bonus_claimed'] else 0)} ETB\n\n"
                "Use /balance to check your account!",
                reply_markup=keyboard
            )
            
            # Show main menu
            await self.show_main_menu(message, user)

    async def show_main_menu(self, message: types.Message, user):
        """Show main menu for verified users"""
        total_balance = user['won_balance'] + user['deposited_balance']
        
        text = (
            f"Welcome back, {user['first_name']}! \n\n"
            f"Balance: {total_balance} ETB\n"
            f"Playable: {user['deposited_balance']} ETB\n"
            f"Withdrawable: {user['won_balance']} ETB\n\n"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Check Balance", callback_data="balance")],
            [InlineKeyboardButton(text="Invite Friends", callback_data="invite")],
            [InlineKeyboardButton(text="Help", callback_data="help")]
        ])
        
        await message.answer(text, reply_markup=keyboard)

    async def handle_unknown_command(self, message: types.Message):
        """Handle unknown commands"""
        await message.answer(
            "Unknown command. Use /start to begin or /help for available commands."
        )

    async def run(self):
        """Start the bot"""
        logger.info("Starting Habesha Bingo Bot...")
        await self.dp.start_polling(self.bot)
        logger.info("Bot started successfully")

def main():
    """Main entry point"""
    try:
        bot = HabeshaBingoBot()
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot error: {e}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - Crypto-Native Bot
Advanced crypto features with live rates and automation
"""

import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
import asyncio
import sqlite3
from contextlib import contextmanager
from datetime import datetime
import uuid
import random

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot Configuration
TOKEN = "YOUR_BOT_TOKEN_HERE"
CURRENT_USDT_ETB_RATE = 150.0  # Current market rate

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Database setup
DB_NAME = "habesha_bingo_crypto.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_db_cursor():
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

def init_crypto_database():
    """Initialize crypto-enabled database"""
    with get_db_cursor() as cursor:
        # Users table with crypto fields
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
        
        # Crypto transactions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crypto_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                currency TEXT NOT NULL,  -- USDT, TON, BTC
                etb_amount REAL NOT NULL,  -- Converted amount
                status TEXT DEFAULT 'pending',  -- pending, confirmed, failed
                tx_hash TEXT,
                wallet_address TEXT,
                confirmations INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Deposit addresses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS deposit_addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                currency TEXT NOT NULL,
                address TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, currency)
            )
        """)
        
        # Referrals with crypto bonuses
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crypto_referrals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referrer_id INTEGER NOT NULL,
                referred_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                base_bonus REAL DEFAULT 2.0,  -- 2 ETB base bonus
                crypto_bonus REAL DEFAULT 5.0,  -- 5 ETB if deposit > $5
                total_bonus REAL DEFAULT 2.0,
                deposit_amount REAL DEFAULT 0.0,  -- In USDT
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (referrer_id) REFERENCES users (id),
                FOREIGN KEY (referred_id) REFERENCES users (id)
            )
        """)
        
        logger.info("Crypto database initialized successfully")

class CryptoBingoBot:
    def __init__(self):
        self.setup_handlers()
        init_crypto_database()
    
    def setup_handlers(self):
        @dp.message(Command("start"))
        async def cmd_start(message: types.Message):
            await self.handle_start(message)
        
        @dp.message(Command("deposit"))
        async def cmd_deposit(message: types.Message):
            await self.handle_deposit(message)
        
        @dp.message(Command("withdraw"))
        async def cmd_withdraw(message: types.Message):
            await self.handle_withdraw(message)
        
        @dp.message(Command("invite"))
        async def cmd_invite(message: types.Message):
            await self.handle_crypto_invite(message)
        
        @dp.message(Command("balance"))
        async def cmd_balance(message: types.Message):
            await self.handle_crypto_balance(message)
        
        @dp.message(Command("help_crypto"))
        async def cmd_help_crypto(message: types.Message):
            await self.handle_crypto_help(message)
        
        @dp.callback_query()
        async def handle_callback(callback: types.CallbackQuery):
            await self.handle_crypto_callback(callback)
        
        @dp.message(F.contact)
        async def handle_contact(message: types.Message):
            await self.handle_contact_verification(message)
    
    async def handle_start(self, message: types.Message):
        """Handle /start with crypto features"""
        user_id = message.from_user.id
        first_name = message.from_user.first_name
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                # Create new user
                cursor.execute("""
                    INSERT INTO users (telegram_id, first_name) VALUES (?, ?)
                """, (user_id, first_name))
                
                welcome_text = (
                    "fire Welcome to Habesha Bingo 2.0! fire\n\n"
                    "bet The most exciting crypto Bingo game! bet\n\n"
                    "cash Play with REAL ETB & Crypto prizes! cash\n\n"
                    "fire First step: Verify your phone fire\n"
                    "Get 10 ETB welcome bonus INSTANTLY! cash\n\n"
                    "Ready to win big? Let's go! "
                )
                
                keyboard = ReplyKeyboardMarkup(
                    keyboard=[[KeyboardButton(text="fire Share Contact fire", request_contact=True)]],
                    resize_keyboard=True,
                    one_time_keyboard=True
                )
                
                await message.answer(welcome_text, reply_markup=keyboard)
                
            elif not user['is_verified']:
                keyboard = ReplyKeyboardMarkup(
                    keyboard=[[KeyboardButton(text="fire Verify Phone fire", request_contact=True)]],
                    resize_keyboard=True,
                    one_time_keyboard=True
                )
                
                await message.answer(
                    f"Hi {user['first_name']}! fire\n\n"
                    "Complete verification to start winning! cash",
                    reply_markup=keyboard
                )
                
            else:
                await self.show_crypto_main_menu(message, user)
    
    async def handle_deposit(self, message: types.Message):
        """Handle crypto deposit with multiple options"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
        
        deposit_text = (
            "fire Deposit Funds (Crypto) fire\n\n"
            "Choose your preferred currency. Funds will be converted to ETB instantly at the current market rate.\n\n"
            "fire USDT (TRC20) - Low fees, stable value fire\n"
            "bet TON - Fastest, native to Telegram bet\n"
            "cash Bitcoin (BTC) - Digital gold cash\n\n"
            "fire Important: Only send funds via the supported networks. "
            "Sending to the wrong network will result in permanent loss. fire"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Select USDT fire", callback_data="deposit_usdt")],
            [InlineKeyboardButton(text="bet Select TON bet", callback_data="deposit_ton")],
            [InlineKeyboardButton(text="cash Select BTC cash", callback_data="deposit_btc")]
        ])
        
        await message.answer(deposit_text, reply_markup=keyboard)
    
    async def handle_withdraw(self, message: types.Message):
        """Handle crypto withdrawal with verification checks"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
            
            total_balance = user['won_balance'] + user['deposited_balance']
            withdrawable_balance = user['won_balance']
            
            # Check 50% rule
            cursor.execute("""
                SELECT SUM(etb_amount) as total_deposits 
                FROM crypto_transactions 
                WHERE user_id = ? AND type = 'deposit' AND status = 'confirmed'
            """, (user['id'],))
            result = cursor.fetchone()
            total_deposits = result['total_deposits'] or 0
            
            # Verification checks
            min_withdrawal_met = withdrawable_balance >= 100
            deposit_rule_met = total_deposits >= (withdrawable_balance * 0.5)
            
            verification_status = f"{'[x]' if min_withdrawal_met else '[ ]'} 50% Deposit Rule Met\n"
            verification_status += f"{'[x]' if deposit_rule_met else '[ ]'} Minimum 100 ETB Reached"
            
            withdraw_text = (
                "fire Withdraw Your Winnings fire\n\n"
                f"bet Withdrawable Balance: {withdrawable_balance} ETB (~{withdrawable_balance/CURRENT_USDT_ETB_RATE:.2f} USDT) bet\n"
                "fire" + "fire" * 20 + "fire\n\n"
                "Enter the amount in ETB to withdraw.\n"
                "Provide your USDT (TRC20) or TON wallet address.\n\n"
                "fire Verification Check: fire\n"
                f"{verification_status}\n\n"
                "cash Withdrawals under 500 ETB are processed instantly! cash"
            )
            
            await message.answer(withdraw_text)
    
    async def handle_crypto_invite(self, message: types.Message):
        """Handle crypto referral program with airdrop bonuses"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Then invite friends to earn bonuses! cash"
                )
                return
            
            # Generate referral link
            bot_username = (await self.bot.get_me()).username
            referral_link = f"https://t.me/{bot_username}?start=REF_{user_id}"
            
            # Get referral stats
            cursor.execute("""
                SELECT cr.*, u.first_name 
                FROM crypto_referrals cr
                JOIN users u ON cr.referred_id = u.id
                WHERE cr.referrer_id = ?
                ORDER BY cr.created_at DESC
            """, (user['id'],))
            referrals = cursor.fetchall()
            
            completed_referrals = [r for r in referrals if r['status'] == 'completed']
            total_bonus = sum(r['total_bonus'] for r in completed_referrals)
            
            invite_text = (
                "fire Airdrop Referral Program fire\n\n"
                "bet Get 2 ETB for every friend who joins! bet\n"
                "cash Bonus: If your friend deposits > $5, you get an extra 5 ETB! cash\n\n"
                f"fire Your Link: {referral_link} fire\n\n"
                f"bet Total Earnings: {total_bonus} ETB bet\n"
                "cash Referral earnings are added to your Deposited Balance (Play Only). cash"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Share Link fire", url=referral_link)],
                [InlineKeyboardButton(text="bet View Referrals bet", callback_data="view_referrals")]
            ])
            
            await message.answer(invite_text, reply_markup=keyboard)
    
    async def handle_crypto_balance(self, message: types.Message):
        """Handle balance with crypto value display"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
            
            total_balance = user['won_balance'] + user['deposited_balance']
            usdt_value = total_balance / CURRENT_USDT_ETB_RATE
            
            balance_text = (
                "fire Live Balance Breakdown fire\n\n"
                f"bet Total: {total_balance} ETB (~${usdt_value:.2f} USDT) bet\n"
                "fire" + "fire" * 20 + "fire\n"
                f"cash Winnings: {user['won_balance']} ETB (Withdrawable) cash\n"
                f"bet Bonus: {user['deposited_balance']} ETB (Play Only) bet\n"
                "fire" + "fire" * 20 + "fire\n"
                f"cash Current Rate: 1 USDT = {CURRENT_USDT_ETB_RATE} ETB cash"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Deposit Funds fire", callback_data="deposit")],
                [InlineKeyboardButton(text="bet Withdraw Winnings bet", callback_data="withdraw")],
                [InlineKeyboardButton(text="cash Play Bingo cash", callback_data="play")]
            ])
            
            await message.answer(balance_text, reply_markup=keyboard)
    
    async def handle_crypto_help(self, message: types.Message):
        """Handle crypto help for new users"""
        help_text = (
            "fire Crypto Help for Habesha Bingo fire\n\n"
            "bet How to Buy USDT: bet\n"
            "1. Create account on Binance\n"
            "2. Go to P2P marketplace\n"
            "3. Find USDT seller with good rating\n"
            "4. Pay with Ethiopian banks\n\n"
            "cash How to Send to Bot: cash\n"
            "1. Copy the unique address\n"
            "2. Send ONLY USDT on TRC20 network\n"
            "3. Wait for 1 confirmation\n"
            "4. Balance updates automatically\n\n"
            "fire What is TRC20? fire\n"
            "TRC20 is USDT on Tron blockchain\n"
            "Low fees (~$1) and fast transfers\n"
            "Perfect for small amounts\n\n"
            "cash Need Help? cash\n"
            "Contact support: @habesha_support"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Start Depositing fire", callback_data="deposit")],
            [InlineKeyboardButton(text="bet View Balance bet", callback_data="balance")]
        ])
        
        await message.answer(help_text, reply_markup=keyboard)
    
    async def handle_crypto_callback(self, callback: types.CallbackQuery):
        """Handle crypto-related callbacks"""
        data = callback.data
        
        if data == "deposit_usdt":
            await self.generate_deposit_address(callback, "USDT")
        elif data == "deposit_ton":
            await self.generate_deposit_address(callback, "TON")
        elif data == "deposit_btc":
            await self.generate_deposit_address(callback, "BTC")
        elif data == "deposit":
            await self.handle_deposit(callback.message)
        elif data == "withdraw":
            await self.handle_withdraw(callback.message)
        elif data == "balance":
            await self.handle_crypto_balance(callback.message)
        elif data == "play":
            await callback.message.answer("fire Game feature coming soon! fire")
        
        await callback.answer()
    
    async def generate_deposit_address(self, callback: types.CallbackQuery, currency: str):
        """Generate unique deposit address for user"""
        user_id = callback.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await callback.message.answer("Please register first using /start")
                return
            
            # Check if address already exists
            cursor.execute("""
                SELECT address FROM deposit_addresses 
                WHERE user_id = ? AND currency = ? AND is_active = 1
            """, (user['id'], currency))
            existing = cursor.fetchone()
            
            if existing:
                address = existing['address']
            else:
                # Generate new address (mock implementation)
                if currency == "USDT":
                    address = f"TLYs{uuid.uuid4().hex[:20]}{random.randint(1000, 9999)}"
                elif currency == "TON":
                    address = f"0:{uuid.uuid4().hex}"
                else:  # BTC
                    address = f"bc1{uuid.uuid4().hex[:32]}"
                
                # Save to database
                cursor.execute("""
                    INSERT INTO deposit_addresses (user_id, currency, address)
                    VALUES (?, ?, ?)
                """, (user['id'], currency, address))
            
            # Create deposit transaction
            cursor.execute("""
                INSERT INTO crypto_transactions (user_id, type, currency, amount, etb_amount, status, wallet_address)
                VALUES (?, 'deposit', ?, 0, 0, 'pending', ?)
            """, (user['id'], currency, address))
            
            # Show deposit info
            rate_text = f"1 {currency} = {CURRENT_USDT_ETB_RATE} ETB" if currency == "USDT" else f"1 {currency} = ~{CURRENT_USDT_ETB_RATE} ETB"
            
            deposit_info = (
                f"fire Your Unique {currency} Address: fire\n"
                f"bet {address} (Tap to copy) bet\n\n"
                f"cash Rate: {rate_text} cash\n"
                "fire Balance will update after 1 network confirmation. fire\n\n"
                "cash Send ONLY {currency} on the correct network! cash"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Copy Address fire", callback_data=f"copy_{address}")],
                [InlineKeyboardButton(text="bet Check Status bet", callback_data="check_deposit")]
            ])
            
            await callback.message.answer(deposit_info, reply_markup=keyboard)
    
    async def handle_contact_verification(self, message: types.Message):
        """Handle contact verification with crypto bonus"""
        user_id = message.from_user.id
        contact = message.contact
        
        if contact.user_id != user_id:
            await message.answer("Security alert: Contact doesn't match your account.")
            return
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await message.answer("Please use /start first.")
                return
            
            # Update user
            cursor.execute("""
                UPDATE users 
                SET phone = ?, is_verified = 1 
                WHERE telegram_id = ?
            """, (contact.phone_number, user_id))
            
            # Give welcome bonus
            if not user['welcome_bonus_claimed']:
                cursor.execute("""
                    UPDATE users 
                    SET deposited_balance = deposited_balance + 10, 
                        welcome_bonus_claimed = 1 
                    WHERE telegram_id = ?
                """, (user_id,))
                
                cursor.execute("""
                    INSERT INTO crypto_transactions (user_id, type, currency, amount, etb_amount, status, description)
                    VALUES (?, 'welcome_bonus', 'ETB', 0, 10, 'completed', 'Welcome bonus')
                """, (user['id'],))
            
            success_text = (
                "fire Verification Successful! fire\n\n"
                "bet Welcome bonus: 10 ETB credited! bet\n"
                "cash Ready to play with crypto! cash\n\n"
                "fire Use /deposit to add funds! fire"
            )
            
            keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
            await message.answer(success_text, reply_markup=keyboard)
            
            # Show main menu
            await self.show_crypto_main_menu(message, user)
    
    async def show_crypto_main_menu(self, message: types.Message, user):
        """Show main menu with crypto features"""
        total_balance = user['won_balance'] + user['deposited_balance']
        usdt_value = total_balance / CURRENT_USDT_ETB_RATE
        
        text = (
            f"fire Welcome back, {user['first_name']}! fire\n\n"
            f"bet Balance: {total_balance} ETB (~${usdt_value:.2f} USDT) bet\n"
            f"cash Ready to win more? Let's play! cash"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Check Balance fire", callback_data="balance")],
            [InlineKeyboardButton(text="bet Deposit Funds bet", callback_data="deposit")],
            [InlineKeyboardButton(text="cash Withdraw Winnings cash", callback_data="withdraw")],
            [InlineKeyboardButton(text="fire Invite Friends fire", callback_data="invite")]
        ])
        
        await message.answer(text, reply_markup=keyboard)
    
    async def run(self):
        """Start the crypto bot"""
        logger.info("Starting Habesha Bingo Crypto Bot...")
        await dp.start_polling(bot)
        logger.info("Crypto bot started successfully")

def main():
    """Main entry point"""
    try:
        bot = CryptoBingoBot()
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        logger.info("Crypto bot stopped by user")
    except Exception as e:
        logger.error(f"Crypto bot error: {e}")

if __name__ == "__main__":
    main()

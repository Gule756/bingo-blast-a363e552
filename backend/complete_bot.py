#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - Complete Bot Implementation
Based on the complete logic blueprint
"""

import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
import asyncio
import sqlite3
from contextlib import contextmanager
from datetime import datetime
import uuid
import hashlib
import hmac

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot Configuration
TOKEN = "YOUR_BOT_TOKEN_HERE"
GULE_ID = 123456789  # Replace with Gule's actual Telegram ID
CURRENT_USDT_ETB_RATE = 150.0
MINI_APP_URL = "https://bingo-blast-a363e552.vercel.app"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Database setup
DB_NAME = "habesha_bingo_complete.db"

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

def init_complete_database():
    """Initialize complete database schema"""
    with get_db_cursor() as cursor:
        # Users table
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
        
        # Deposits table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Deposits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT NOT NULL,
                currency TEXT NOT NULL,
                amount DECIMAL(15,8) NOT NULL,
                etb_amount DECIMAL(15,2) NOT NULL,
                address TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                tx_hash TEXT,
                confirmations INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users (user_id)
            )
        """)
        
        # Withdrawals table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Withdrawals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                currency TEXT NOT NULL,
                wallet_address TEXT NOT NULL,
                status TEXT DEFAULT 'processing',
                tx_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users (user_id)
            )
        """)
        
        # Transactions table (for all financial operations)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BIGINT NOT NULL,
                type TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users (user_id)
            )
        """)
        
        # Game sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS GameSessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT UNIQUE NOT NULL,
                stake_amount DECIMAL(15,2) NOT NULL,
                player_count INTEGER DEFAULT 0,
                total_pot DECIMAL(15,2) DEFAULT 0,
                status TEXT DEFAULT 'lobby',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                ended_at TIMESTAMP
            )
        """)
        
        logger.info("Complete database initialized successfully")

class CompleteBingoBot:
    def __init__(self):
        self.setup_handlers()
        init_complete_database()
    
    def setup_handlers(self):
        @dp.message(Command("start"))
        async def cmd_start(message: types.Message):
            await self.handle_start(message)
        
        @dp.message(Command("register"))
        async def cmd_register(message: types.Message):
            await self.handle_register(message)
        
        @dp.message(Command("balance"))
        async def cmd_balance(message: types.Message):
            await self.handle_balance(message)
        
        @dp.message(Command("invite"))
        async def cmd_invite(message: types.Message):
            await self.handle_invite(message)
        
        @dp.message(Command("deposit"))
        async def cmd_deposit(message: types.Message):
            await self.handle_deposit(message)
        
        @dp.message(Command("withdraw"))
        async def cmd_withdraw(message: types.Message):
            await self.handle_withdraw(message)
        
        @dp.message(Command("play"))
        async def cmd_play(message: types.Message):
            await self.handle_play(message)
        
        @dp.message(Command("instructions"))
        async def cmd_instructions(message: types.Message):
            await self.handle_instructions(message)
        
        @dp.message(Command("transfer"))
        async def cmd_transfer(message: types.Message):
            await self.handle_transfer(message)
        
        @dp.message(Command("cancel"))
        async def cmd_cancel(message: types.Message):
            await self.handle_cancel(message)
        
        @dp.message(Command("admin_panel"))
        async def cmd_admin_panel(message: types.Message):
            await self.handle_admin_panel(message)
        
        @dp.message(F.contact)
        async def handle_contact(message: types.Message):
            await self.handle_contact_verification(message)
        
        @dp.callback_query()
        async def handle_callback(callback: types.CallbackQuery):
            await self.handle_callback(callback)
    
    async def handle_start(self, message: types.Message):
        """1. /start - The Entry Gate"""
        user_id = message.from_user.id
        first_name = message.from_user.first_name
        last_name = message.from_user.last_name or ""
        username = message.from_user.username
        
        # Parse referral parameters
        args = message.text.split()[1:] if len(message.text.split()) > 1 else []
        referrer_id = None
        
        if args and args[0].startswith("REF_"):
            try:
                referrer_id = int(args[0][4:])
            except ValueError:
                pass
        
        with get_db_cursor() as cursor:
            # Check if user exists
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                # Special Check: Gule ID
                is_gule = user_id == GULE_ID
                
                # Insert new user
                cursor.execute("""
                    INSERT INTO Users 
                    (user_id, username, phone_number, deposited_balance, won_balance, 
                     is_verified, referrer_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (user_id, username, None, 
                      1000000 if is_gule else 0,  # Gule gets 1M ETB
                      0, 
                      True if is_gule else False,
                      referrer_id))
                
                if is_gule:
                    await message.answer(
                        "fire Welcome back, Gule! fire\n\n"
                        "bet God Mode activated! bet\n"
                        "cash Balance: 1,000,000 ETB cash\n\n"
                        "fire Ready to test everything! fire"
                    )
                    return
                
                # New user - show welcome
                welcome_text = (
                    "fire Welcome to Habesha Bingo 2.0! fire\n\n"
                    "bet The most exciting Bingo game in Ethiopia! bet\n\n"
                    "cash Play with REAL ETB prizes! cash\n\n"
                    "fire First step: Verify your phone fire\n"
                    "Get 10 ETB welcome bonus INSTANTLY! cash\n\n"
                    "Ready to win big? Let's go! "
                )
                
                keyboard = ReplyKeyboardMarkup(
                    keyboard=[[KeyboardButton(text="fire Verify Phone fire", request_contact=True)]],
                    resize_keyboard=True,
                    one_time_keyboard=True
                )
                
                await message.answer(welcome_text, reply_markup=keyboard)
                
            else:
                # Existing user
                if not user['is_verified']:
                    # Not verified - show verification
                    keyboard = ReplyKeyboardMarkup(
                        keyboard=[[KeyboardButton(text="fire Verify Phone fire", request_contact=True)]],
                        resize_keyboard=True,
                        one_time_keyboard=True
                    )
                    
                    await message.answer(
                        f"Hi {first_name}! fire\n\n"
                        "Complete verification to start winning! cash",
                        reply_markup=keyboard
                    )
                else:
                    # Verified user - show welcome back
                    total_balance = user['deposited_balance'] + user['won_balance']
                    
                    welcome_text = (
                        f"fire Welcome back, {first_name}! fire\n\n"
                        f"bet Balance: {total_balance} ETB bet\n"
                        f"cash Ready to win more? Let's play! cash"
                    )
                    
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="fire Check Balance fire", callback_data="balance")],
                        [InlineKeyboardButton(text="bet Play Bingo bet", callback_data="play")],
                        [InlineKeyboardButton(text="cash Invite Friends cash", callback_data="invite")]
                    ])
                    
                    await message.answer(welcome_text, reply_markup=keyboard)
    
    async def handle_register(self, message: types.Message):
        """2. /register - Bonus & Verification"""
        await message.answer(
            "fire Please use the 'Verify Phone' button from /start fire\n\n"
            "bet This ensures you get your 10 ETB bonus! bet"
        )
    
    async def handle_contact_verification(self, message: types.Message):
        """Handle phone verification - part of /register logic"""
        user_id = message.from_user.id
        contact = message.contact
        
        if contact.user_id != user_id:
            await message.answer("Security alert: Contact doesn't match your account.")
            return
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await message.answer("Please use /start first.")
                return
            
            # Check if phone already exists
            cursor.execute("SELECT user_id FROM Users WHERE phone_number = ? AND user_id != ?", 
                         (contact.phone_number, user_id))
            existing_user = cursor.fetchone()
            
            if existing_user:
                await message.answer("This phone number is already registered with another account.")
                return
            
            # Update user with phone number
            cursor.execute("""
                UPDATE Users 
                SET phone_number = ?, is_verified = True 
                WHERE user_id = ?
            """, (contact.phone_number, user_id))
            
            # Check if bonus claimed
            if not user['bonus_claimed']:
                # Give welcome bonus
                cursor.execute("""
                    UPDATE Users 
                    SET deposited_balance = deposited_balance + 10, 
                        bonus_claimed = True 
                    WHERE user_id = ?
                """, (user_id,))
                
                # Create transaction record
                cursor.execute("""
                    INSERT INTO Transactions (user_id, type, amount, description)
                    VALUES (?, 'welcome_bonus', 10, 'Welcome bonus')
                """, (user_id,))
                
                bonus_text = "fire 10 ETB welcome bonus added! fire\n"
            else:
                bonus_text = ""
            
            # Handle referral bonus
            if user['referrer_id']:
                cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user['referrer_id'],))
                referrer = cursor.fetchone()
                
                if referrer and referrer['referral_count'] < 20:
                    # Give referral bonus
                    cursor.execute("""
                        UPDATE Users 
                        SET deposited_balance = deposited_balance + 2, 
                            referral_count = referral_count + 1 
                        WHERE user_id = ?
                    """, (user['referrer_id'],))
                    
                    cursor.execute("""
                        INSERT INTO Transactions (user_id, type, amount, description)
                        VALUES (?, 'referral_bonus', 2, ?)
                    """, (user['referrer_id'], f"Referral bonus for {contact.first_name}"))
            
            success_text = (
                f"fire Phone verified! fire\n\n"
                f"{bonus_text}"
                f"bet Ready to play and win! bet"
            )
            
            keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
            await message.answer(success_text, reply_markup=keyboard)
            
            # Show main menu
            await self.show_main_menu(message, user_id)
    
    async def handle_balance(self, message: types.Message):
        """3. /balance - The Ledger"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
            
            deposited = user['deposited_balance']
            won = user['won_balance']
            total = deposited + won
            
            balance_text = (
                "fire Balance Breakdown fire\n\n"
                f"bet Total Balance: {total} ETB bet\n"
                f"cash Winnings: {won} ETB (Withdrawable) cash\n"
                f"fire Bonus Funds: {deposited} ETB (Play Only) fire\n\n"
                "fire Withdrawal Policy: fire\n"
                "bet Minimum withdrawal: 100 ETB bet\n"
                "cash Must have deposited 50% of winnings cash"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Withdraw Winnings fire", callback_data="withdraw")],
                [InlineKeyboardButton(text="bet Deposit Funds bet", callback_data="deposit")],
                [InlineKeyboardButton(text="cash Play Bingo cash", callback_data="play")]
            ])
            
            await message.answer(balance_text, reply_markup=keyboard)
    
    async def handle_invite(self, message: types.Message):
        """4. /invite - Growth Engine"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Then invite friends to earn bonuses! cash"
                )
                return
            
            # Generate referral link
            referral_link = f"https://t.me/{(await self.bot.get_me()).username}?start=REF_{user_id}"
            
            # Count verified referrals
            cursor.execute("""
                SELECT COUNT(*) as count FROM Users 
                WHERE referrer_id = ? AND is_verified = True
            """, (user_id,))
            referral_count = cursor.fetchone()['count']
            
            # Calculate earnings
            earnings = referral_count * 2
            remaining_slots = 20 - referral_count
            
            invite_text = (
                "fire Invite Friends & Earn! fire\n\n"
                f"bet Your Link: {referral_link} bet\n\n"
                f"cash Referrals: {referral_count}/20 cash\n"
                f"fire Earnings: {earnings} ETB fire\n"
                f"bet Remaining slots: {remaining_slots} bet\n\n"
                "cash Each verified friend earns you 2 ETB! cash"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Share Link fire", url=referral_link)],
                [InlineKeyboardButton(text="bet View Referrals bet", callback_data="view_referrals")]
            ])
            
            await message.answer(invite_text, reply_markup=keyboard)
    
    async def handle_deposit(self, message: types.Message):
        """5. /deposit - Crypto Inflow"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
        
        deposit_text = (
            "fire Deposit Funds fire\n\n"
            "bet Select Currency: bet\n"
            "fire USDT (TRC20) - Low fees fire\n"
            "cash TON - Fast, native to Telegram cash\n\n"
            "fire Current Rate: 1 USDT = {CURRENT_USDT_ETB_RATE} ETB fire"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire USDT (TRC20) fire", callback_data="deposit_usdt")],
            [InlineKeyboardButton(text="cash TON cash", callback_data="deposit_ton")]
        ])
        
        await message.answer(deposit_text, reply_markup=keyboard)
    
    async def handle_withdraw(self, message: types.Message):
        """6. /withdraw - Cash Out"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
            
            won_balance = user['won_balance']
            lifetime_deposits = user['lifetime_deposits']
            
            # Step 1: Check minimum withdrawal
            if won_balance < 100:
                await message.answer(
                    f"fire Minimum withdrawal is 100 ETB fire\n\n"
                    f"bet Your withdrawable balance: {won_balance} ETB bet\n"
                    "cash Keep playing to reach the minimum! cash"
                )
                return
            
            # Step 2: Check 50% rule
            required_deposits = won_balance * 0.5
            if lifetime_deposits < required_deposits:
                await message.answer(
                    "fire 50% Deposit Rule fire\n\n"
                    f"bet You need {required_deposits:.2f} ETB in lifetime deposits bet\n"
                    f"cash Your deposits: {lifetime_deposits:.2f} ETB cash\n\n"
                    "fire Deposit more to unlock withdrawals! fire"
                )
                return
            
            # Passes all checks - proceed with withdrawal
            withdraw_text = (
                "fire Withdrawal Request fire\n\n"
                f"bet Available: {won_balance} ETB bet\n"
                f"cash Enter amount and wallet address: cash\n\n"
                "fire Format: withdraw [amount] [USDT/TON] [address] fire\n"
                "bet Example: withdraw 100 USDT TXxxxxxxxxxxxxx bet"
            )
            
            await message.answer(withdraw_text)
            
            # Set user state to 'withdrawing'
            cursor.execute("""
                UPDATE Users SET current_state = 'withdrawing' WHERE user_id = ?
            """, (user_id,))
    
    async def handle_play(self, message: types.Message):
        """7. /play - Launch Mini App"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
            
            if not user['is_verified']:
                await message.answer(
                    "fire Please verify your phone first fire\n\n"
                    "bet Use the 'Verify Phone' button from /start bet"
                )
                return
            
            # Generate auth hash
            auth_data = f"user_id={user_id}&timestamp={int(datetime.utcnow().timestamp())}"
            auth_hash = hmac.new(
                b"your_secret_key",
                auth_data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Create WebApp button
            web_app_url = f"{MINI_APP_URL}?{auth_data}&auth_hash={auth_hash}"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text="fire Play Bingo fire", 
                    web_app=WebAppInfo(url=web_app_url)
                )]
            ])
            
            await message.answer(
                "fire Launch Bingo Game! fire\n\n"
                "bet Click below to start playing! bet",
                reply_markup=keyboard
            )
    
    async def handle_instructions(self, message: types.Message):
        """8. /instructions - The Rulebook"""
        instructions_text = (
            "fire How to Play Habesha Bingo fire\n\n"
            "bet Step 1: Card Selection bet\n"
            "Choose 1-3 cards from 400 available\n"
            "Each card costs the stake amount\n\n"
            "cash Step 2: Number Calling cash\n"
            "Numbers 1-75 are called every 3 seconds\n"
            "B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75\n"
            "Center N square is always FREE!\n\n"
            "fire Step 3: Winning Patterns fire\n"
            "fire Horizontal: 5 numbers in a row fire\n"
            "bet Vertical: 5 numbers in a column bet\n"
            "cash Diagonal: 5 numbers diagonally cash\n"
            "fire Corners: All 4 corner squares fire\n"
            "bet Full House: All 24 numbers bet\n\n"
            "cash Important Rules: cash\n"
            "fire False Bingo: Claiming bingo without a valid pattern "
            "will result in disconnection from the game fire\n"
            "bet Server Validation: All bingo claims are verified "
            "by the server to prevent cheating bet\n\n"
            "cash Good luck and play fair! cash"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Play Now fire", callback_data="play")],
            [InlineKeyboardButton(text="bet Check Balance bet", callback_data="balance")]
        ])
        
        await message.answer(instructions_text, reply_markup=keyboard)
    
    async def handle_transfer(self, message: types.Message):
        """9. /transfer - Internal Move"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['is_verified']:
                await message.answer(
                    "fire Please register first using /start fire\n"
                    "Let's get you winning! bet"
                )
                return
            
            won_balance = user['won_balance']
            
            if won_balance <= 0:
                await message.answer(
                    "fire No winnings available to transfer fire\n\n"
                    "bet Keep playing to build your winnings! bet"
                )
                return
            
            transfer_text = (
                "fire Transfer Winnings fire\n\n"
                f"bet Available to transfer: {won_balance} ETB bet\n"
                "cash Move winnings to play balance (cannot be reversed) cash\n\n"
                "fire Format: transfer [amount] fire\n"
                "bet Example: transfer 50 bet"
            )
            
            await message.answer(transfer_text)
            
            # Set user state to 'transferring'
            cursor.execute("""
                UPDATE Users SET current_state = 'transferring' WHERE user_id = ?
            """, (user_id,))
    
    async def handle_cancel(self, message: types.Message):
        """10. /cancel - State Reset"""
        user_id = message.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT current_state FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user or not user['current_state']:
                await message.answer(
                    "fire No active process to cancel fire\n\n"
                    "bet Ready to help! bet"
                )
                return
            
            # Clear current state
            cursor.execute("""
                UPDATE Users SET current_state = NULL WHERE user_id = ?
            """, (user_id,))
            
            await message.answer(
                "fire Process cancelled fire\n\n"
                "bet What would you like to do next? bet"
            )
    
    async def handle_admin_panel(self, message: types.Message):
        """Admin God Mode Command"""
        user_id = message.from_user.id
        
        if user_id != GULE_ID:
            await message.answer("fire Access Denied fire")
            return
        
        admin_text = (
            "fire Admin Panel fire\n\n"
            "bet Available commands: bet\n"
            "cash /broadcast [message] - Send to all users cash\n"
            "fire /pause_game - Pause bingo loop fire\n"
            "bet /rate [amount] - Update USDT/ETB rate bet\n"
            "cash /kill_switch - Force logout all users cash"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Broadcast fire", callback_data="admin_broadcast")],
            [InlineKeyboardButton(text="bet Pause Game bet", callback_data="admin_pause")],
            [InlineKeyboardButton(text="cash Update Rate cash", callback_data="admin_rate")]
        ])
        
        await message.answer(admin_text, reply_markup=keyboard)
    
    async def handle_callback(self, callback: types.CallbackQuery):
        """Handle inline keyboard callbacks"""
        data = callback.data
        
        if data == "deposit_usdt":
            await self.generate_deposit_address(callback, "USDT")
        elif data == "deposit_ton":
            await self.generate_deposit_address(callback, "TON")
        elif data == "balance":
            await self.handle_balance(callback.message)
        elif data == "play":
            await self.handle_play(callback.message)
        elif data == "withdraw":
            await self.handle_withdraw(callback.message)
        elif data == "deposit":
            await self.handle_deposit(callback.message)
        elif data == "invite":
            await self.handle_invite(callback.message)
        
        await callback.answer()
    
    async def generate_deposit_address(self, callback: types.CallbackQuery, currency: str):
        """Generate unique deposit address"""
        user_id = callback.from_user.id
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                await callback.message.answer("Please register first using /start")
                return
            
            # Generate unique address
            if currency == "USDT":
                address = f"TLYs{uuid.uuid4().hex[:20]}{random.randint(1000, 9999)}"
            else:  # TON
                address = f"0:{uuid.uuid4().hex}"
            
            # Create deposit record
            cursor.execute("""
                INSERT INTO Deposits (user_id, currency, amount, etb_amount, address, status)
                VALUES (?, ?, 0, 0, ?, 'pending')
            """, (user_id, currency, address))
            
            deposit_info = (
                f"fire Deposit {currency} fire\n\n"
                f"bet Send to this address: bet\n"
                f"cash {address} cash\n\n"
                f"fire Rate: 1 {currency} = {CURRENT_USDT_ETB_RATE} ETB fire\n"
                "bet Balance updates after 1 confirmation bet"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Copy Address fire", callback_data=f"copy_{address}")],
                [InlineKeyboardButton(text="bet Check Status bet", callback_data="check_deposit")]
            ])
            
            await callback.message.answer(deposit_info, reply_markup=keyboard)
    
    async def show_main_menu(self, message: types.Message, user_id: int):
        """Show main menu"""
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                return
            
            total = user['deposited_balance'] + user['won_balance']
            
            menu_text = (
                f"fire Main Menu fire\n\n"
                f"bet Balance: {total} ETB bet\n"
                "cash What would you like to do? cash"
            )
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Check Balance fire", callback_data="balance")],
                [InlineKeyboardButton(text="bet Play Bingo bet", callback_data="play")],
                [InlineKeyboardButton(text="cash Deposit Funds cash", callback_data="deposit")],
                [InlineKeyboardButton(text="fire Invite Friends fire", callback_data="invite")]
            ])
            
            await message.answer(menu_text, reply_markup=keyboard)
    
    async def run(self):
        """Start the complete bot"""
        logger.info("Starting Complete Habesha Bingo Bot...")
        await dp.start_polling(bot)
        logger.info("Complete bot started successfully")

def main():
    """Main entry point"""
    try:
        bot = CompleteBingoBot()
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot error: {e}")

if __name__ == "__main__":
    main()

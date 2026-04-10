#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - Localized Amharic Bot
With engaging content and Habesha energy!
"""

import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
import sqlite3
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot Configuration
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
GULE_TEST_ID = 123456789

# Database setup
DB_NAME = "habesha_bingo.db"

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

class HabeshaBingoLocalized:
    def __init__(self):
        self.bot = Bot(token=BOT_TOKEN)
        self.dp = Dispatcher()
        self.setup_handlers()

    def setup_handlers(self):
        @self.dp.message(Command("start"))
        async def cmd_start(message: types.Message):
            await self.handle_start(message)
        
        @self.dp.message(Command("balance"))
        async def cmd_balance(message: types.Message):
            await self.handle_balance(message)
        
        @self.dp.message(Command("instructions"))
        async def cmd_instructions(message: types.Message):
            await self.handle_instructions(message)
        
        @self.dp.message(Command("invite"))
        async def cmd_invite(message: types.Message):
            await self.handle_invite(message)
        
        @self.dp.message(F.contact)
        async def handle_contact(message: types.Message):
            await self.handle_contact_verification(message)

    async def handle_start(self, message: types.Message):
        """Handle /start with Amharic localization"""
        user_id = message.from_user.id
        first_name = message.from_user.first_name
        last_name = message.from_user.last_name or ""
        username = message.from_user.username
        
        # Parse referral
        args = message.text.split()[1:] if len(message.text.split()) > 1 else []
        referral_code = None
        if args and args[0].startswith("REF_"):
            referral_code = args[0][4:]
        
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                # New user - exciting welcome!
                welcome_text = (
                    "fire Welcome to Habesha Bingo 2.0! fire\n\n"
                    "bet The most exciting Bingo game in Ethiopia! bet\n\n"
                    "cash Play with REAL ETB prizes! cash\n\n"
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
                # User exists but not verified
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
                # Verified user - main menu with energy
                await self.show_main_menu(message, user)

    async def handle_balance(self, message: types.Message):
        """Handle /balance with exciting Amharic style"""
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
                "cash Your Balance Information cash\n\n"
                f"fire Total Balance: {total_balance} ETB fire\n"
                f"bet Won Balance: {user['won_balance']} ETB (Withdrawable) bet\n"
                f"cash Deposited Balance: {user['deposited_balance']} ETB (Play Only) cash\n\n"
            )
            
            if transactions:
                text += "fire Recent Transactions: fire\n"
                for tx in transactions:
                    symbol = "+" if tx['type'] in ["deposit", "win", "welcome_bonus", "referral_bonus"] else "-"
                    tx_type = tx['type'].replace('_', ' ').title()
                    text += f"{symbol}{tx['amount']} ETB - {tx_type}\n"
            
            text += "\nfire Ready to play more? Let's go! fire"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="cash View All Transactions cash", callback_data="tx_history")],
                [InlineKeyboardButton(text="fire Play Bingo NOW! fire", callback_data="play_bingo")],
                [InlineKeyboardButton(text="bet Invite Friends & Earn! bet", callback_data="invite")]
            ])
            
            await message.answer(text, reply_markup=keyboard)

    async def handle_instructions(self, message: types.Message):
        """Handle /instructions with Amharic localization"""
        instructions_text = (
            "fire How to Play Habesha Bingo fire\n\n"
            "bet Step 1: Select Cards bet\n"
            "Choose 1-3 bingo cards (5x5 grid)\n"
            "Each card costs ETB stake amount\n\n"
            "cash Step 2: Game Starts cash\n"
            "Numbers 1-75 called every 3 seconds\n"
            "Mark your cards as numbers are called\n\n"
            "fire Step 3: Win Big! fire\n"
            "Complete winning patterns:\n"
            "5 in a row (Horizontal, Vertical, Diagonal)\n"
            "4 corners\n"
            "Full house (all 24 numbers)\n\n"
            "bet Card Layout: bet\n"
            "B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75\n"
            "Center N square is always FREE!\n\n"
            "cash Good luck! Let's win together! cash\n\n"
            "fire Ready to play? Use /start to begin! fire"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Play Now! fire", callback_data="play")],
            [InlineKeyboardButton(text="bet Check Balance bet", callback_data="balance")]
        ])
        
        await message.answer(instructions_text, reply_markup=keyboard)

    async def handle_invite(self, message: types.Message):
        """Handle /invite with exciting referral program"""
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
                "fire Invite Friends & Earn 2 ETB Each! fire\n\n"
                f"Your referral link:\n{referral_link}\n\n"
                f"cash Progress: {progress}/{max_referrals} referrals cash\n"
                f"bet Bonus earned: {len(completed_referrals) * 2} ETB bet\n\n"
            )
            
            if progress >= max_referrals:
                text += "fire You've reached maximum referrals! fire\n"
                text += "You're a true Habesha Bingo champion! cash"
            else:
                remaining_bonus = 2 * (max_referrals - progress)
                text += f"fire Earn {remaining_bonus} more ETB from referrals! fire\n"
                text += "Keep sharing and winning! bet"
            
            text += "\n\ncash Share your link and start earning today! cash"
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Share Link fire", url=referral_link)],
                [InlineKeyboardButton(text="bet View Referrals bet", callback_data="view_referrals")]
            ])
            
            await message.answer(text, reply_markup=keyboard)

    async def handle_contact_verification(self, message: types.Message):
        """Handle contact verification with exciting confirmation"""
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
            bonus_given = False
            if not user['welcome_bonus_claimed']:
                cursor.execute("""
                    UPDATE users 
                    SET deposited_balance = deposited_balance + 10, 
                        welcome_bonus_claimed = 1 
                    WHERE telegram_id = ?
                """, (user_id,))
                
                cursor.execute("""
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'welcome_bonus', 10, 'completed', 'Welcome bonus')
                """, (user['id'],))
                bonus_given = True
            
            # Success message with energy
            keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
            
            success_text = (
                "fire Verification Successful! fire\n\n"
                f"bet Welcome bonus: 10 ETB credited! bet\n"
            )
            
            if bonus_given:
                new_balance = user['won_balance'] + user['deposited_balance'] + 10
                success_text += f"cash Your balance: {new_balance} ETB cash\n"
            else:
                new_balance = user['won_balance'] + user['deposited_balance']
                success_text += f"cash Your balance: {new_balance} ETB cash\n"
            
            success_text += "\nfire Ready to win BIG? Let's play! fire"
            
            await message.answer(success_text, reply_markup=keyboard)
            
            # Show main menu
            await self.show_main_menu(message, user)

    async def show_main_menu(self, message: types.Message, user):
        """Show main menu with Habesha energy"""
        total_balance = user['won_balance'] + user['deposited_balance']
        
        text = (
            f"fire Welcome back, {user['first_name']}! fire\n\n"
            f"cash Balance: {total_balance} ETB cash\n"
            f"bet Playable: {user['deposited_balance']} ETB bet\n"
            f"cash Withdrawable: {user['won_balance']} ETB cash\n\n"
            "fire Ready to win more? Let's go! fire"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Check Balance fire", callback_data="balance")],
            [InlineKeyboardButton(text="bet Invite Friends bet", callback_data="invite")],
            [InlineKeyboardButton(text="cash Play Bingo cash", callback_data="play")],
            [InlineKeyboardButton(text="fire Help fire", callback_data="help")]
        ])
        
        await message.answer(text, reply_markup=keyboard)

    async def run(self):
        """Start the localized bot"""
        logger.info("Starting Habesha Bingo Localized Bot...")
        await self.dp.start_polling(self.bot)
        logger.info("Bot started successfully")

def main():
    """Main entry point"""
    try:
        bot = HabeshaBingoLocalized()
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot error: {e}")

if __name__ == "__main__":
    main()

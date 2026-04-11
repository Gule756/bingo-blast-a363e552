#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - Debug Version
Includes heartbeat test and enhanced logging
"""

import asyncio
import logging
import os
import sys
from dotenv import load_dotenv
import asyncpg
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# Configure enhanced logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more info
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot_debug.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
YOUR_TELEGRAM_ID = int(os.getenv("GULE_TEST_ACCOUNT_ID", "0"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://bingo-blast-a363e552.vercel.app")

# Enhanced logging for configuration
logger.info(f"Bot Token: {BOT_TOKEN[:10]}..." if BOT_TOKEN else "BOT_TOKEN NOT SET")
logger.info(f"Database URL: {DATABASE_URL[:20]}..." if DATABASE_URL else "DATABASE_URL NOT SET")
logger.info(f"Your Telegram ID: {YOUR_TELEGRAM_ID}")
logger.info(f"Mini App URL: {MINI_APP_URL}")

# Database connection pool
db_pool = None

# FSM States
class UserStates(StatesGroup):
    withdrawing = State()
    depositing = State()
    transferring = State()

async def create_db_pool():
    """Create PostgreSQL connection pool with enhanced error handling"""
    global db_pool
    try:
        logger.info("Attempting to create database connection pool...")
        db_pool = await asyncpg.create_pool(
            DATABASE_URL, 
            min_size=2, 
            max_size=10,
            command_timeout=10  # Add timeout
        )
        logger.info("PostgreSQL connection pool created successfully")
        
        # Test the connection
        async with db_pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            logger.info(f"Database test query result: {result}")
        
        return db_pool
    except Exception as e:
        logger.error(f"Failed to create database pool: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e)}")
        raise

async def close_db_pool():
    """Close database connection pool"""
    global db_pool
    if db_pool:
        await db_pool.close()
        logger.info("Database connection pool closed")

# Database helper functions with enhanced logging
async def get_user(user_id: int):
    """Get user from database"""
    try:
        logger.debug(f"Getting user {user_id} from database...")
        async with db_pool.acquire() as conn:
            result = await conn.fetchrow(
                "SELECT * FROM users WHERE user_id = $1",
                user_id
            )
            user_data = dict(result) if result else None
            logger.debug(f"User data retrieved: {user_data}")
            return user_data
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        return None

async def create_user(user_id: int, username: str, referrer_id: int = None):
    """Create new user in database"""
    try:
        logger.debug(f"Creating user {user_id} with username {username}...")
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (user_id, username, referrer_id, deposited_balance, won_balance, is_verified)
                VALUES ($1, $2, $3, 0, 0, $4)
                ON CONFLICT (user_id) DO NOTHING
                """,
                user_id, username, referrer_id, user_id == YOUR_TELEGRAM_ID
            )
            
            # Special handling for Gule account
            if user_id == YOUR_TELEGRAM_ID:
                await conn.execute(
                    "UPDATE users SET deposited_balance = 1000000, is_verified = TRUE WHERE user_id = $1",
                    user_id
                )
                logger.info(f"Gule account created with 1,000,000 ETB balance")
        
        logger.info(f"User {user_id} created successfully")
    except Exception as e:
        logger.error(f"Error creating user {user_id}: {e}")
        raise

async def update_user_balance(user_id: int, deposited: float = None, won: float = None):
    """Update user balance"""
    try:
        logger.debug(f"Updating balance for user {user_id}: deposited={deposited}, won={won}")
        async with db_pool.acquire() as conn:
            updates = []
            params = []
            param_count = 1
            
            if deposited is not None:
                updates.append(f"deposited_balance = ${param_count}")
                params.append(deposited)
                param_count += 1
                
            if won is not None:
                updates.append(f"won_balance = ${param_count}")
                params.append(won)
                param_count += 1
            
            params.append(user_id)
            
            await conn.execute(
                f"UPDATE users SET {', '.join(updates)} WHERE user_id = ${param_count}",
                *params
            )
        
        logger.info(f"Balance updated for user {user_id}")
    except Exception as e:
        logger.error(f"Error updating balance for user {user_id}: {e}")
        raise

async def get_referral_count(user_id: int):
    """Get referral count for user"""
    try:
        logger.debug(f"Getting referral count for user {user_id}")
        async with db_pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT COUNT(*) FROM users WHERE referrer_id = $1 AND is_verified = TRUE",
                user_id
            )
            count = result or 0
            logger.debug(f"Referral count for user {user_id}: {count}")
            return count
    except Exception as e:
        logger.error(f"Error getting referral count for user {user_id}: {e}")
        return 0

async def get_lifetime_deposits(user_id: int):
    """Get lifetime deposits for user"""
    try:
        logger.debug(f"Getting lifetime deposits for user {user_id}")
        async with db_pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE user_id = $1 AND status = 'confirmed'",
                user_id
            )
            deposits = result or 0
            logger.debug(f"Lifetime deposits for user {user_id}: {deposits}")
            return deposits
    except Exception as e:
        logger.error(f"Error getting lifetime deposits for user {user_id}: {e}")
        return 0

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# HEARTBEAT TEST - Add this at the very top
@dp.message()
async def heartbeat(message: types.Message):
    """Heartbeat test to check if bot is alive"""
    print(f"Received message: {message.text}")  # This shows in your terminal
    logger.info(f"Heartbeat received: {message.text} from user {message.from_user.id}")
    
    # Only respond to non-command messages for heartbeat
    if not message.text.startswith('/'):
        await message.answer("fire I am alive! fire")
        logger.info("Heartbeat response sent")

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    """Handle /start command"""
    logger.info(f"Start command received from user {message.from_user.id}")
    
    try:
        user_id = message.from_user.id
        username = message.from_user.username or "Unknown"
        
        # Parse referral parameter
        args = message.text.split()[1:] if len(message.text.split()) > 1 else []
        referrer_id = None
        
        if args and args[0].startswith("REF_"):
            try:
                referrer_id = int(args[0][4:])
                logger.info(f"Referral detected: {referrer_id}")
            except ValueError:
                logger.warning(f"Invalid referral format: {args[0]}")
        
        # Create user if doesn't exist
        await create_user(user_id, username, referrer_id)
        
        # Get user info
        user = await get_user(user_id)
        
        if not user:
            await message.answer("fire Error creating user. Please try again. fire")
            return
        
        # Check if verified
        if not user['is_verified']:
            logger.info(f"User {user_id} not verified, requesting phone")
            # Ask for phone verification
            keyboard = ReplyKeyboardMarkup(
                keyboard=[[KeyboardButton(text="fire Verify Phone fire", request_contact=True)]],
                resize_keyboard=True,
                one_time_keyboard=True
            )
            
            await message.answer(
                "fire Welcome to Habesha Bingo 2.0! fire\n\n"
                "bet Please verify your phone number to get started: bet\n"
                "cash You'll receive a 10 ETB welcome bonus! cash",
                reply_markup=keyboard
            )
        else:
            logger.info(f"User {user_id} already verified, showing main menu")
            # Already verified - show main menu
            total_balance = (user['deposited_balance'] or 0) + (user['won_balance'] or 0)
            
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="fire Check Balance fire", callback_data="balance")],
                [InlineKeyboardButton(text="bet Play Bingo bet", web_app=WebAppInfo(url=MINI_APP_URL))],
                [InlineKeyboardButton(text="cash Invite Friends cash", callback_data="invite")]
            ])
            
            await message.answer(
                f"fire Welcome back, {message.from_user.first_name}! fire\n\n"
                f"bet Your balance: {total_balance} ETB bet\n"
                "cash Ready to play and win! cash",
                reply_markup=keyboard
            )
        
        logger.info(f"Start command processed successfully for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error in start command: {e}")
        await message.answer("fire An error occurred. Please try again. fire")

@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    """Handle /balance command"""
    logger.info(f"Balance command received from user {message.from_user.id}")
    
    try:
        user_id = message.from_user.id
        
        user = await get_user(user_id)
        
        if not user:
            await message.answer("fire Please use /start to register first. fire")
            return
        
        # Handle NULL values by defaulting to 0
        deposited_balance = user['deposited_balance'] or 0
        won_balance = user['won_balance'] or 0
        total_balance = deposited_balance + won_balance
        
        balance_text = (
            "fire Balance Information fire\n\n"
            f"bet Total Balance: {total_balance} ETB bet\n"
            f"cash Winnings: {won_balance} ETB (Withdrawable) cash\n"
            f"fire Bonus Funds: {deposited_balance} ETB (Play Only) fire\n\n"
            "cash Use /withdraw to cash out your winnings! cash"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="fire Withdraw Winnings fire", callback_data="withdraw")],
            [InlineKeyboardButton(text="bet Deposit Funds bet", callback_data="deposit")]
        ])
        
        await message.answer(balance_text, reply_markup=keyboard)
        logger.info(f"Balance command processed for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error in balance command: {e}")
        await message.answer("fire Error fetching balance. Please try again. fire")

@dp.message(Command("ping"))
async def cmd_ping(message: types.Message):
    """Simple ping command for testing"""
    logger.info(f"Ping command received from user {message.from_user.id}")
    await message.answer("fire Pong! Bot is responding! fire")

@dp.message(Command("test"))
async def cmd_test(message: types.Message):
    """Test command to check bot functionality"""
    logger.info(f"Test command received from user {message.from_user.id}")
    
    try:
        # Test database connection
        if db_pool:
            async with db_pool.acquire() as conn:
                result = await conn.fetchval("SELECT NOW()")
                await message.answer(f"fire Database connected! Server time: {result} fire")
        else:
            await message.answer("fire Database not connected! fire")
            
    except Exception as e:
        logger.error(f"Error in test command: {e}")
        await message.answer(f"fire Test failed: {str(e)} fire")

@dp.message(F.contact)
async def handle_contact(message: types.Message, state: FSMContext):
    """Handle contact verification"""
    logger.info(f"Contact received from user {message.from_user.id}")
    
    try:
        user_id = message.from_user.id
        contact = message.contact
        
        if contact.user_id != user_id:
            await message.answer("fire Security alert: Contact doesn't match your account. fire")
            return
        
        # Update user verification
        async with db_pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET phone = $1, is_verified = TRUE WHERE user_id = $2",
                contact.phone_number, user_id
            )
        
        # Give welcome bonus if not already given
        user = await get_user(user_id)
        if user and not user.get('welcome_bonus_given', False):
            await update_user_balance(user_id, deposited=10)
            
            # Mark bonus as given
            async with db_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE users SET welcome_bonus_given = TRUE WHERE user_id = $1",
                    user_id
                )
            
            bonus_text = "fire 10 ETB welcome bonus added! fire\n"
        else:
            bonus_text = ""
        
        keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
        
        await message.answer(
            f"fire Phone verified successfully! fire\n\n"
            f"{bonus_text}"
            f"bet Ready to play and win! bet",
            reply_markup=keyboard
        )
        
        logger.info(f"Contact verification completed for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error handling contact: {e}")
        await message.answer("fire Error verifying contact. Please try again. fire")

@dp.callback_query()
async def handle_callback(callback: types.CallbackQuery, state: FSMContext):
    """Handle inline keyboard callbacks"""
    logger.info(f"Callback received: {callback.data} from user {callback.from_user.id}")
    
    try:
        data = callback.data
        
        if data == "balance":
            await cmd_balance(callback.message)
        elif data == "deposit":
            await callback.message.answer("fire Deposit feature coming soon! fire")
        elif data == "withdraw":
            await callback.message.answer("fire Withdraw feature coming soon! fire")
        elif data == "invite":
            await callback.message.answer("fire Invite feature coming soon! fire")
        
        await callback.answer()
        
    except Exception as e:
        logger.error(f"Error handling callback: {e}")
        await callback.answer("fire Error occurred. fire")

async def main():
    """Main function with enhanced error handling"""
    logger.info("Starting Habesha Bingo Bot (Debug Version)...")
    
    try:
        # Check configuration
        if not BOT_TOKEN:
            logger.error("TELEGRAM_BOT_TOKEN is not set!")
            return
        
        if not DATABASE_URL:
            logger.error("DATABASE_URL is not set!")
            return
        
        # Create database pool
        await create_db_pool()
        
        # Test bot connection
        bot_info = await bot.get_me()
        logger.info(f"Bot connected: @{bot_info.username}")
        
        # Start bot
        logger.info("Starting bot polling...")
        await dp.start_polling(bot)
        
    except Exception as e:
        logger.error(f"Fatal error in main: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e)}")
    finally:
        # Close database pool
        await close_db_pool()
        logger.info("Bot shutdown complete")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        print(f"Fatal error: {e}")
        print("Check bot_debug.log for details")

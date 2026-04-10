#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - PostgreSQL Bot Implementation
Using aiogram 3.x with PostgreSQL connection pool
"""

import asyncio
import logging
import os
from dotenv import load_dotenv
import asyncpg
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
YOUR_TELEGRAM_ID = int(os.getenv("YOUR_TELEGRAM_ID", "0"))
MINI_APP_URL = "https://bingo-blast-a363e552.vercel.app"

# Database connection pool
db_pool = None

# FSM States
class UserStates(StatesGroup):
    withdrawing = State()
    depositing = State()
    transferring = State()

async def create_db_pool():
    """Create PostgreSQL connection pool"""
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        logger.info("PostgreSQL connection pool created successfully")
        return db_pool
    except Exception as e:
        logger.error(f"Failed to create database pool: {e}")
        raise

async def close_db_pool():
    """Close database connection pool"""
    global db_pool
    if db_pool:
        await db_pool.close()
        logger.info("Database connection pool closed")

# Database helper functions
async def get_user(user_id: int):
    """Get user from database"""
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            "SELECT * FROM users WHERE user_id = $1",
            user_id
        )
        return dict(result) if result else None

async def create_user(user_id: int, username: str, referrer_id: int = None):
    """Create new user in database"""
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

async def update_user_balance(user_id: int, deposited: float = None, won: float = None):
    """Update user balance"""
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

async def get_referral_count(user_id: int):
    """Get referral count for user"""
    async with db_pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE referrer_id = $1 AND is_verified = TRUE",
            user_id
        )
        return result or 0

async def get_lifetime_deposits(user_id: int):
    """Get lifetime deposits for user"""
    async with db_pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE user_id = $1 AND status = 'confirmed'",
            user_id
        )
        return result or 0

# Initialize bot and dispatcher
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    """Handle /start command"""
    user_id = message.from_user.id
    username = message.from_user.username or "Unknown"
    
    # Parse referral parameter
    args = message.text.split()[1:] if len(message.text.split()) > 1 else []
    referrer_id = None
    
    if args and args[0].startswith("REF_"):
        try:
            referrer_id = int(args[0][4:])
        except ValueError:
            pass
    
    # Create user if doesn't exist
    await create_user(user_id, username, referrer_id)
    
    # Get user info
    user = await get_user(user_id)
    
    if not user:
        await message.answer("fire Error creating user. Please try again. fire")
        return
    
    # Check if verified
    if not user['is_verified']:
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

@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    """Handle /balance command"""
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

@dp.message(Command("deposit"))
async def cmd_deposit(message: types.Message, state: FSMContext):
    """Handle /deposit command"""
    user_id = message.from_user.id
    
    user = await get_user(user_id)
    
    if not user or not user['is_verified']:
        await message.answer("fire Please register and verify your phone first. fire")
        return
    
    # Show currency selection
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="fire USDT (TRC20) fire", callback_data="deposit_usdt")],
        [InlineKeyboardButton(text="cash TON cash", callback_data="deposit_ton")]
    ])
    
    await message.answer(
        "fire Choose deposit currency: fire\n\n"
        "bet USDT (TRC20) - Low fees, stable value bet\n"
        "cash TON - Fast, native to Telegram cash",
        reply_markup=keyboard
    )

@dp.message(Command("withdraw"))
async def cmd_withdraw(message: types.Message, state: FSMContext):
    """Handle /withdraw command with 50% Rule"""
    user_id = message.from_user.id
    
    user = await get_user(user_id)
    
    if not user or not user['is_verified']:
        await message.answer("fire Please register and verify your phone first. fire")
        return
    
    won_balance = user['won_balance'] or 0
    lifetime_deposits = await get_lifetime_deposits(user_id)
    
    # Check minimum withdrawal
    if won_balance < 100:
        await message.answer(
            f"fire Minimum withdrawal is 100 ETB fire\n\n"
            f"bet Your withdrawable balance: {won_balance} ETB bet\n"
            "cash Keep playing to reach the minimum! cash"
        )
        return
    
    # Check 50% Rule
    required_deposits = won_balance * 0.5
    if lifetime_deposits < required_deposits:
        await message.answer(
            "fire 50% Deposit Rule fire\n\n"
            f"bet You need {required_deposits:.2f} ETB in lifetime deposits bet\n"
            f"cash Your deposits: {lifetime_deposits:.2f} ETB cash\n\n"
            "fire Deposit more to unlock withdrawals! fire"
        )
        return
    
    # Set state for withdrawal
    await state.set_state(UserStates.withdrawing)
    
    await message.answer(
        "fire Withdrawal Request fire\n\n"
        f"bet Available: {won_balance} ETB bet\n"
        "cash Enter amount and wallet address: cash\n\n"
        "fire Format: withdraw [amount] [USDT/TON] [address] fire\n"
        "bet Example: withdraw 100 USDT TXxxxxxxxxxxxxx bet"
    )

@dp.message(Command("invite"))
async def cmd_invite(message: types.Message):
    """Handle /invite command"""
    user_id = message.from_user.id
    
    user = await get_user(user_id)
    
    if not user or not user['is_verified']:
        await message.answer("fire Please register and verify your phone first. fire")
        return
    
    # Generate referral link
    bot_username = (await bot.get_me()).username
    referral_link = f"https://t.me/{bot_username}?start=REF_{user_id}"
    
    # Get referral count
    referral_count = await get_referral_count(user_id)
    earnings = referral_count * 2
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="fire Share Link fire", url=referral_link)]
    ])
    
    await message.answer(
        f"fire Invite Friends & Earn! fire\n\n"
        f"bet Your Link: {referral_link} bet\n"
        f"cash Referrals: {referral_count}/20 cash\n"
        f"fire Earnings: {earnings} ETB fire\n\n"
        "cash Each verified friend earns you 2 ETB! cash",
        reply_markup=keyboard
    )

@dp.message(Command("instructions"))
async def cmd_instructions(message: types.Message):
    """Handle /instructions command"""
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
        [InlineKeyboardButton(text="fire Play Now fire", web_app=WebAppInfo(url=MINI_APP_URL))],
        [InlineKeyboardButton(text="bet Check Balance bet", callback_data="balance")]
    ])
    
    await message.answer(instructions_text, reply_markup=keyboard)

@dp.message(Command("cancel"))
async def cmd_cancel(message: types.Message, state: FSMContext):
    """Handle /cancel command"""
    current_state = await state.get_state()
    
    if current_state is None:
        await message.answer("fire No active process to cancel. fire\n\n"
                           "bet Ready to help! bet")
    else:
        await state.clear()
        await message.answer("fire Process cancelled successfully. fire\n\n"
                           "bet What would you like to do next? bet")

@dp.message(Command("play"))
async def cmd_play(message: types.Message):
    """Handle /play command - Mini App connection"""
    user_id = message.from_user.id
    
    user = await get_user(user_id)
    
    if not user or not user['is_verified']:
        await message.answer("fire Please register and verify your phone first. fire\n\n"
                           "bet Use /start to get started! bet")
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="fire Play Bingo fire", web_app=WebAppInfo(url=MINI_APP_URL))]
    ])
    
    await message.answer(
        "fire Launch Bingo Game! fire\n\n"
        "bet Click below to start playing! bet",
        reply_markup=keyboard
    )

@dp.message(F.contact)
async def handle_contact(message: types.Message, state: FSMContext):
    """Handle contact verification"""
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

@dp.callback_query()
async def handle_callback(callback: types.CallbackQuery, state: FSMContext):
    """Handle inline keyboard callbacks"""
    data = callback.data
    
    if data == "balance":
        await cmd_balance(callback.message)
    elif data == "deposit":
        await cmd_deposit(callback.message, state)
    elif data == "withdraw":
        await cmd_withdraw(callback.message, state)
    elif data == "invite":
        await cmd_invite(callback.message)
    elif data == "deposit_usdt":
        await callback.message.edit_text(
            "fire USDT Deposit fire\n\n"
            "bet Send USDT to: TLYsXXXXXXXXXXXXXXXXXXXX bet\n"
            "cash Balance updates after 1 confirmation cash",
            reply_markup=None
        )
    elif data == "deposit_ton":
        await callback.message.edit_text(
            "fire TON Deposit fire\n\n"
            "bet Send TON to: 0:XXXXXXXXXXXXXXXXXXXX bet\n"
            "cash Balance updates after 1 confirmation cash",
            reply_markup=None
        )
    
    await callback.answer()

async def main():
    """Main function"""
    # Create database pool
    await create_db_pool()
    
    # Start bot
    try:
        logger.info("Starting Habesha Bingo Bot...")
        await dp.start_polling(bot)
    finally:
        # Close database pool
        await close_db_pool()

if __name__ == "__main__":
    asyncio.run(main())

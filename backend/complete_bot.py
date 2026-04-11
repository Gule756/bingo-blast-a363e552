#!/usr/bin/env python3
"""
Habesha Bingo 2.0 - Complete Bot Implementation (Supabase Version)
Updated to use Supabase PostgreSQL instead of SQLite
"""

import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
import asyncio
import os
from dotenv import load_dotenv
from datetime import datetime
import uuid
import hashlib
import hmac

# Import Supabase database and models
from database import Database
from models import User, Transaction
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot Configuration
load_dotenv()
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GULE_ID = int(os.getenv("GULE_TEST_ACCOUNT_ID", "123456789"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://bingo-blast-a363e552.vercel.app")

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Database setup
db = Database()

async def init_database():
    """Initialize Supabase database connection"""
    try:
        await db.initialize()
        logger.info("Supabase database initialized successfully!")
        return True
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False

# Bot handlers
@dp.message(Command("start"))
async def handle_start(message: types.Message):
    """Handle /start command - always register in Supabase"""
    user_id = message.from_user.id
    username = message.from_user.username or message.from_user.first_name
    
    try:
        # Get or create user in Supabase
        user = await db.get_user_by_telegram_id(user_id)
        
        if not user:
            # Create new user in Supabase
            user = await db.create_user(
                telegram_id=user_id,
                first_name=message.from_user.first_name,
                last_name=message.from_user.last_name or "",
                username=message.from_user.username or ""
            )
            
            welcome_text = f"""
Welcome to Habesha Bingo 2.0, {user.first_name}! 

Your account has been created successfully.

Current Balance: 0 ETB

To get started:
1. Share your contact to claim 10 ETB welcome bonus
2. Invite friends for 2 ETB per referral
3. Deposit funds to play bingo games

Send /register to claim your welcome bonus!
"""
        else:
            # Update last active
            await db.update_user(user.id, last_active=datetime.utcnow())
            
            welcome_text = f"""
Welcome back to Habesha Bingo 2.0, {user.first_name}!

Current Balance: {user.won_balance + user.deposited_balance} ETB
- Won Balance: {user.won_balance} ETB (withdrawable)
- Deposited Balance: {user.deposited_balance} ETB (play only)

Use /balance for detailed breakdown
Use /play to launch the bingo game
"""
        
        # Check if this is Gule's test account
        if user_id == GULE_ID:
            await db.update_user_balance(user.id, won_balance=1000000)
            await db.update_user(user.id, is_verified=True, god_mode=True)
            welcome_text += "\n\nGULE MODE ACTIVATED - 1,000,000 ETB balance added!"
        
        # Create keyboard
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton("/balance")],
                [KeyboardButton("/deposit"), KeyboardButton("/withdraw")],
                [KeyboardButton("/play"), KeyboardButton("/invite")],
                [KeyboardButton("/register") if not user.is_verified else KeyboardButton("/instructions")]
            ],
            resize_keyboard=True
        )
        
        await message.answer(welcome_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Error in /start handler: {e}")
        await message.answer("Sorry, there was an error processing your request. Please try again.")

@dp.message(Command("register"))
async def handle_register(message: types.Message):
    """Handle user registration and contact verification"""
    user_id = message.from_user.id
    
    try:
        user = await db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first to create your account.")
            return
        
        if user.is_verified:
            await message.answer("Your account is already verified!")
            return
        
        # Request contact sharing
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton("Share Contact", request_contact=True)]
            ],
            resize_keyboard=True,
            one_time_keyboard=True
        )
        
        await message.answer(
            "To verify your account and claim your 10 ETB welcome bonus, please share your contact information:",
            reply_markup=keyboard
        )
        
    except Exception as e:
        logger.error(f"Error in /register handler: {e}")
        await message.answer("Sorry, there was an error. Please try again.")

@dp.message(F.contact)
async def handle_contact(message: types.Message):
    """Handle contact sharing for verification"""
    user_id = message.from_user.id
    contact = message.contact
    
    try:
        # Verify the contact belongs to the user
        if contact.user_id != user_id:
            await message.answer("This contact doesn't belong to you. Please share your own contact.")
            return
        
        user = await db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first to create your account.")
            return
        
        if user.is_verified:
            await message.answer("Your account is already verified!")
            return
        
        # Check if phone already exists
        if contact.phone_number:
            existing_user = await db.get_user_by_phone(contact.phone_number)
            if existing_user and existing_user.id != user.id:
                await message.answer("This phone number is already registered to another account.")
                return
        
        # Update user and give welcome bonus
        await db.update_user(user.id, phone=contact.phone_number, is_verified=True)
        
        if not user.welcome_bonus_claimed:
            await db.update_user_balance(user.id, deposited_balance=10)
            await db.update_user(user.id, welcome_bonus_claimed=True)
            
            # Create transaction record
            await db.create_transaction(
                user_id=user.id,
                type="welcome_bonus",
                amount=10,
                status="completed",
                description="Welcome bonus for account verification"
            )
            
            bonus_text = "\n\nCongratulations! 10 ETB welcome bonus has been added to your account!"
        else:
            bonus_text = ""
        
        await message.answer(
            f"Account verified successfully!{bonus_text}\n\n"
            f"Current Balance: {(user.won_balance) + (user.deposited_balance + (10 if not user.welcome_bonus_claimed else 0))} ETB"
        )
        
    except Exception as e:
        logger.error(f"Error in contact handler: {e}")
        await message.answer("Sorry, there was an error verifying your contact. Please try again.")

@dp.message(Command("balance"))
async def handle_balance(message: types.Message):
    """Show user balance breakdown"""
    user_id = message.from_user.id
    
    try:
        user = await db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first to create your account.")
            return
        
        # Get recent transactions
        transactions = await db.get_user_transactions(user.id, limit=5)
        
        balance_text = f"""
Account Balance for {user.first_name}

Total Balance: {user.won_balance + user.deposited_balance} ETB
- Won Balance: {user.won_balance} ETB (withdrawable)
- Deposited Balance: {user.deposited_balance} ETB (play only)

Status: {'Verified' if user.is_verified else 'Not Verified'}
Referrals: {user.referral_count}

Recent Transactions:
"""
        
        for tx in transactions:
            balance_text += f"\n{tx.type}: +{tx.amount} ETB ({tx.status})"
        
        await message.answer(balance_text)
        
    except Exception as e:
        logger.error(f"Error in /balance handler: {e}")
        await message.answer("Sorry, there was an error fetching your balance.")

@dp.message(Command("deposit"))
async def handle_deposit(message: types.Message):
    """Handle deposit requests"""
    user_id = message.from_user.id
    
    try:
        user = await db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first to create your account.")
            return
        
        if not user.is_verified:
            await message.answer("Please verify your account first using /register")
            return
        
        # Create deposit options
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton("USDT", callback_data="deposit_usdt")],
            [InlineKeyboardButton("TON", callback_data="deposit_ton")]
        ])
        
        await message.answer(
            "Choose deposit currency:",
            reply_markup=keyboard
        )
        
    except Exception as e:
        logger.error(f"Error in /deposit handler: {e}")
        await message.answer("Sorry, there was an error processing your deposit request.")

@dp.message(Command("play"))
async def handle_play(message: types.Message):
    """Launch the Mini App"""
    user_id = message.from_user.id
    
    try:
        user = await db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first to create your account.")
            return
        
        # Create WebApp button
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                "Play Bingo", 
                web_app=WebAppInfo(url=MINI_APP_URL)
            )]
        ])
        
        await message.answer(
            "Click below to launch the Bingo Game:",
            reply_markup=keyboard
        )
        
    except Exception as e:
        logger.error(f"Error in /play handler: {e}")
        await message.answer("Sorry, there was an error launching the game.")

@dp.message(Command("invite"))
async def handle_invite(message: types.Message):
    """Handle referral system"""
    user_id = message.from_user.id
    
    try:
        user = await db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first to create your account.")
            return
        
        # Generate referral link
        bot_username = (await bot.get_me()).username
        referral_link = f"https://t.me/{bot_username}?start={user_id}"
        
        invite_text = f"""
Invite friends and earn 2 ETB per referral!

Your referral link: {referral_link}

How it works:
1. Share this link with friends
2. When they register and verify, you get 2 ETB
3. Maximum 20 referrals allowed
4. Bonus added to your deposited balance

Current referrals: {user.referral_count}/20
"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton("Share Link", url=f"https://t.me/share/url?url={referral_link}&text=Join%20me%20in%20Habesha%20Bingo%20and%20earn%20money!")]
        ])
        
        await message.answer(invite_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Error in /invite handler: {e}")
        await message.answer("Sorry, there was an error generating your referral link.")

@dp.message(Command("admin_panel"))
async def handle_admin_panel(message: types.Message):
    """Admin panel for Gule"""
    user_id = message.from_user.id
    
    if user_id != GULE_ID:
        await message.answer("Access denied. Admin only.")
        return
    
    try:
        # Get system stats
        # Note: You would need to add these methods to your Database class
        total_users = 0  # await db.get_total_users()
        total_balance = 0  # await db.get_total_balance()
        
        admin_text = f"""
GULE ADMIN PANEL

System Statistics:
- Total Users: {total_users}
- Total Balance: {total_balance} ETB

Admin Commands:
/broadcast - Send message to all users
/update_rates - Update USDT/ETB rates
/pause_game - Pause game system
/stats - Detailed statistics
"""
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton("Broadcast", callback_data="admin_broadcast")],
            [InlineKeyboardButton("Update Rates", callback_data="admin_rates")],
            [InlineKeyboardButton("System Stats", callback_data="admin_stats")]
        ])
        
        await message.answer(admin_text, reply_markup=keyboard)
        
    except Exception as e:
        logger.error(f"Error in admin panel: {e}")
        await message.answer("Admin panel error.")

async def main():
    """Main bot function"""
    print("Starting Habesha Bingo 2.0 Bot (Supabase Version)...")
    
    # Initialize database
    if not await init_database():
        print("Failed to initialize database. Exiting.")
        return
    
    # Start bot
    await dp.start_polling(bot)
    logger.info("Bot started successfully!")

if __name__ == "__main__":
    asyncio.run(main())

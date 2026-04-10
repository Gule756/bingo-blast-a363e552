import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from aiogram.enums import ParseMode

from database import Database
from game_engine import GameEngine
from crypto_service import CryptoService
from config import settings

logger = logging.getLogger(__name__)

class TelegramBotHandler:
    def __init__(self, db: Database, crypto_service: CryptoService, game_engine: GameEngine):
        self.db = db
        self.crypto_service = crypto_service
        self.game_engine = game_engine
        self.bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        self.dp = Dispatcher()
        self.running = False
        
        self._setup_handlers()

    def _setup_handlers(self):
        """Setup bot command handlers"""
        
        @self.dp.message(Command("start"))
        async def cmd_start(message: types.Message):
            await self._handle_start(message)
        
        @self.dp.message(Command("register"))
        async def cmd_register(message: types.Message):
            await self._handle_register(message)
        
        @self.dp.message(Command("balance"))
        async def cmd_balance(message: types.Message):
            await self._handle_balance(message)
        
        @self.dp.message(Command("invite"))
        async def cmd_invite(message: types.Message):
            await self._handle_invite(message)
        
        @self.dp.message(Command("deposit"))
        async def cmd_deposit(message: types.Message):
            await self._handle_deposit(message)
        
        @self.dp.message(Command("withdraw"))
        async def cmd_withdraw(message: types.Message):
            await self._handle_withdraw(message)
        
        @self.dp.message(Command("instructions"))
        async def cmd_instructions(message: types.Message):
            await self._handle_instructions(message)
        
        @self.dp.message(Command("help"))
        async def cmd_help(message: types.Message):
            await self._handle_help(message)
        
        @self.dp.message(Command("cancel"))
        async def cmd_cancel(message: types.Message):
            await self._handle_cancel(message)
        
        # Handle contact sharing
        @self.dp.message(F.contact)
        async def handle_contact(message: types.Message):
            await self._handle_contact(message)
        
        # Handle callback queries
        @self.dp.callback_query()
        async def handle_callback(callback: types.CallbackQuery):
            await self._handle_callback(callback)

    async def start(self):
        """Start the bot"""
        self.running = True
        await self.dp.start_polling(self.bot)
        logger.info("Telegram bot started")

    async def stop(self):
        """Stop the bot"""
        self.running = False
        await self.dp.stop_polling()
        await self.bot.session.close()
        logger.info("Telegram bot stopped")

    async def _handle_start(self, message: types.Message):
        """Handle /start command"""
        user_id = message.from_user.id
        
        # Parse start parameters for referrals
        args = message.text.split()[1:] if len(message.text.split()) > 1 else []
        referral_code = None
        
        if args and args[0].startswith("REF_"):
            referral_code = args[0][4:]
        
        # Get or create user
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user:
            # New user - show welcome and registration
            welcome_text = (
                "Welcome to Habesha Bingo 2.0! \n\n"
                "Play multiplayer Bingo with real ETB prizes!\n\n"
                "First, verify your phone number to get started:"
            )
            
            keyboard = ReplyKeyboardMarkup(
                keyboard=[[KeyboardButton(text="Share Contact", request_contact=True)]],
                resize_keyboard=True,
                one_time_keyboard=True
            )
            
            await message.answer(welcome_text, reply_markup=keyboard)
            
        elif not user.is_verified:
            # User exists but not verified
            keyboard = ReplyKeyboardMarkup(
                keyboard=[[KeyboardButton(text="Share Contact", request_contact=True)]],
                resize_keyboard=True,
                one_time_keyboard=True
            )
            
            await message.answer(
                f"Hi {user.first_name}! Please verify your phone number to continue:",
                reply_markup=keyboard
            )
            
        else:
            # Existing verified user
            # Check for Gule test account
            if user_id == settings.GULE_TEST_ACCOUNT_ID:
                await self.db.update_user(user.id, god_mode=True)
                await self.db.update_user_balance(user.id, won_balance=1000000)
            
            # Show main menu
            await self._show_main_menu(message, user)

    async def _handle_register(self, message: types.Message):
        """Handle /register command"""
        user_id = message.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user:
            await message.answer("Please use /start to register first.")
            return
        
        if user.is_verified:
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

    async def _handle_balance(self, message: types.Message):
        """Handle /balance command"""
        user_id = message.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user or not user.is_verified:
            await message.answer("Please register first using /start")
            return
        
        total_balance = user.won_balance + user.deposited_balance
        
        # Get recent transactions
        transactions = await self.db.get_user_transactions(user.id, limit=5)
        
        text = (
            f"Your Balance Information\n\n"
            f"Total Balance: {total_balance} ETB\n"
            f"Won Balance: {user.won_balance} ETB (Withdrawable)\n"
            f"Deposited Balance: {user.deposited_balance} ETB (Play Only)\n\n"
        )
        
        if transactions:
            text += "Recent Transactions:\n"
            for tx in transactions:
                symbol = "+" if tx.type in ["deposit", "win", "welcome_bonus", "referral_bonus"] else "-"
                text += f"{symbol}{tx.amount} ETB - {tx.type.replace('_', ' ').title()}\n"
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Transaction History", callback_data="tx_history")],
            [InlineKeyboardButton(text="Play Bingo", web_app=WebAppInfo(url=f"{settings.MINI_APP_URL}?action=play"))]
        ])
        
        await message.answer(text, reply_markup=keyboard)

    async def _handle_invite(self, message: types.Message):
        """Handle /invite command"""
        user_id = message.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user or not user.is_verified:
            await message.answer("Please register first using /start")
            return
        
        # Generate referral link
        referral_link = f"https://t.me/{self.bot.username}?start=REF_{user.telegram_id}"
        
        # Get referral stats
        referrals = await self.db.get_referrals_by_referrer(user.id)
        completed_referrals = [r for r in referrals if r.status == "completed"]
        
        max_referrals = int(await self.db.get_config("max_referrals") or "20")
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

    async def _handle_deposit(self, message: types.Message):
        """Handle /deposit command"""
        user_id = message.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user or not user.is_verified:
            await message.answer("Please register first using /start")
            return
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="USDT (TRC20)", callback_data="deposit_usdt")],
            [InlineKeyboardButton(text="TON", callback_data="deposit_ton")]
        ])
        
        await message.answer(
            "Choose deposit method:",
            reply_markup=keyboard
        )

    async def _handle_withdraw(self, message: types.Message):
        """Handle /withdraw command"""
        user_id = message.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user or not user.is_verified:
            await message.answer("Please register first using /start")
            return
        
        if user.won_balance < 100:
            await message.answer(
                "Minimum withdrawal is 100 ETB.\n"
                f"Your withdrawable balance: {user.won_balance} ETB"
            )
            return
        
        # Check 50% rule
        total_deposits = await self.db.get_total_deposits(user.id)
        if total_deposits < (user.won_balance * 0.5):
            await message.answer(
                "Total deposits must be at least 50% of withdrawal amount.\n"
                f"Your deposits: {total_deposits} ETB\n"
                f"Max withdrawal: {total_deposits * 2} ETB"
            )
            return
        
        await message.answer(
            "To withdraw, please provide:\n"
            "1. Amount (ETB)\n"
            "2. Cryptocurrency (USDT or TON)\n"
            "3. Your wallet address\n\n"
            "Example: withdraw 100 USDT TXxxxxxxxxxxxxxxxxxxxxxx"
        )

    async def _handle_instructions(self, message: types.Message):
        """Handle /instructions command"""
        instructions_text = (
            "How to Play Habesha Bingo\n\n"
            "1. Select 1-3 bingo cards (5x5 grid)\n"
            "2. Numbers from 1-75 will be called every 3 seconds\n"
            "3. Mark your cards as numbers are called\n"
            "4. Claim BINGO when you complete a winning pattern\n\n"
            "Winning Patterns:\n"
            "5 numbers in a row (Horizontal, Vertical, Diagonal)\n"
            "4 corners\n"
            "Full house (all 24 numbers)\n\n"
            "Card Layout:\n"
            "B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75\n"
            "Center N square is always FREE!\n\n"
            "Good luck! \n"
        )
        
        await message.answer(instructions_text)

    async def _handle_help(self, message: types.Message):
        """Handle /help command"""
        help_text = (
            "Habesha Bingo 2.0 Commands\n\n"
            "/start - Start or return to main menu\n"
            "/register - Register your account\n"
            "/balance - Check your balance and transactions\n"
            "/deposit - Add funds to your account\n"
            "/withdraw - Withdraw your winnings\n"
            "/invite - Invite friends and earn bonuses\n"
            "/instructions - How to play\n"
            "/help - Show this help message\n"
            "/cancel - Cancel current action\n\n"
            "Play at: " + settings.MINI_APP_URL
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Play Bingo", web_app=WebAppInfo(url=settings.MINI_APP_URL))],
            [InlineKeyboardButton(text="Check Balance", callback_data="balance")]
        ])
        
        await message.answer(help_text, reply_markup=keyboard)

    async def _handle_cancel(self, message: types.Message):
        """Handle /cancel command"""
        keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
        await message.answer("Action cancelled.", reply_markup=keyboard)

    async def _handle_contact(self, message: types.Message):
        """Handle contact sharing"""
        user_id = message.from_user.id
        contact = message.contact
        
        # Verify contact belongs to user
        if contact.user_id != user_id:
            await message.answer("Security alert: Contact doesn't match your account.")
            return
        
        user = await self.db.get_user_by_telegram_id(user_id)
        if not user:
            await message.answer("Please use /start first.")
            return
        
        # Check if phone already exists
        existing_user = await self.db.get_user_by_phone(contact.phone_number)
        if existing_user and existing_user.id != user.id:
            await message.answer("This phone number is already registered with another account.")
            return
        
        # Update user
        await self.db.update_user(
            user.id, 
            phone=contact.phone_number, 
            is_verified=True
        )
        
        # Give welcome bonus if not already claimed
        if not user.welcome_bonus_claimed:
            await self.db.update_user_balance(user.id, deposited_balance=10)
            await self.db.update_user(user.id, welcome_bonus_claimed=True)
            
            await self.db.create_transaction(
                user_id=user.id,
                type="welcome_bonus",
                amount=10,
                status="completed"
            )
        
        # Show success message
        keyboard = ReplyKeyboardMarkup(remove_keyboard=True)
        await message.answer(
            "Verification successful! \n"
            f"Welcome bonus: 10 ETB credited!\n"
            f"Your balance: {user.won_balance + user.deposited_balance + (10 if not user.welcome_bonus_claimed else 0)} ETB\n\n"
            "Use /play to start playing!",
            reply_markup=keyboard
        )
        
        # Show main menu
        await self._show_main_menu(message, user)

    async def _handle_callback(self, callback: types.CallbackQuery):
        """Handle callback queries"""
        data = callback.data
        
        if data == "balance":
            await self._handle_balance(callback.message)
        elif data == "tx_history":
            await self._show_transaction_history(callback)
        elif data == "view_referrals":
            await self._show_referrals(callback)
        elif data == "deposit_usdt":
            await self._process_deposit(callback, "USDT")
        elif data == "deposit_ton":
            await self._process_deposit(callback, "TON")
        
        await callback.answer()

    async def _show_main_menu(self, message: types.Message, user):
        """Show main menu"""
        total_balance = user.won_balance + user.deposited_balance
        
        text = (
            f"Welcome back, {user.first_name}! \n\n"
            f"Balance: {total_balance} ETB\n"
            f"Playable: {user.deposited_balance} ETB\n"
            f"Withdrawable: {user.won_balance} ETB\n\n"
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Play Bingo", web_app=WebAppInfo(url=settings.MINI_APP_URL))],
            [InlineKeyboardButton(text="Check Balance", callback_data="balance")],
            [InlineKeyboardButton(text="Deposit", callback_data="deposit")],
            [InlineKeyboardButton(text="Withdraw", callback_data="withdraw")],
            [InlineKeyboardButton(text="Invite Friends", callback_data="invite")]
        ])
        
        await message.answer(text, reply_markup=keyboard)

    async def _show_transaction_history(self, callback: types.CallbackQuery):
        """Show transaction history"""
        user_id = callback.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user:
            await callback.message.answer("User not found.")
            return
        
        transactions = await self.db.get_user_transactions(user.id, limit=20)
        
        if not transactions:
            await callback.message.answer("No transactions found.")
            return
        
        text = "Transaction History:\n\n"
        for tx in transactions:
            symbol = "+" if tx.type in ["deposit", "win", "welcome_bonus", "referral_bonus"] else "-"
            text += f"{symbol}{tx.amount} ETB - {tx.type.replace('_', ' ').title()}\n"
            text += f"Status: {tx.status}\n"
            text += f"Date: {tx.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
        
        await callback.message.answer(text)

    async def _show_referrals(self, callback: types.CallbackQuery):
        """Show referral details"""
        user_id = callback.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user:
            await callback.message.answer("User not found.")
            return
        
        referrals = await self.db.get_referrals_by_referrer(user.id)
        
        if not referrals:
            await callback.message.answer("No referrals yet.")
            return
        
        text = "Your Referrals:\n\n"
        for referral in referrals:
            status_emoji = "Completed" if referral.status == "completed" else "Pending"
            text += f"{referral.referred.first_name} - {status_emoji}\n"
            if referral.status == "completed":
                text += f"Bonus: {referral.bonus_amount} ETB\n"
            text += f"Date: {referral.created_at.strftime('%Y-%m-%d')}\n\n"
        
        await callback.message.answer(text)

    async def _process_deposit(self, callback: types.CallbackQuery, currency: str):
        """Process deposit request"""
        user_id = callback.from_user.id
        user = await self.db.get_user_by_telegram_id(user_id)
        
        if not user:
            await callback.message.answer("User not found.")
            return
        
        # Generate deposit address
        address = await self.crypto_service.generate_deposit_address(user.id, currency)
        
        text = (
            f"Deposit {currency}\n\n"
            f"Send {currency} to this address:\n"
            f"`{address}`\n\n"
            f"Your account will be credited after 1 confirmation.\n"
            f"Current rate: 1 USDT = 55 ETB (approximate)"
        )
        
        await callback.message.answer(text, parse_mode=ParseMode.MARKDOWN)

import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
import asyncio

# 1. Replace this with your actual Token from BotFather
TOKEN = "YOUR_BOT_TOKEN_HERE"

bot = Bot(token=TOKEN)
dp = Dispatcher()

# 2. This is the logic for the /start command
@dp.message(Command("start"))
async def start_handler(message: types.Message):
    # This sends the text back to the user
    await message.answer(
        "fire Welcome to Habesha Bingo! fire\n\n"
        "bet Please verify your phone number to receive your **10 ETB** bonus. bet"
    )
    
    # 3. This creates the "Share Contact" button
    keyboard = types.ReplyKeyboardMarkup(
        keyboard=[
            [types.KeyboardButton(text="fire Verify Phone Number fire", request_contact=True)]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )
    
    await message.answer("Click the button below to get started:", reply_markup=keyboard)

# 4. Start the bot
async def main():
    print("Bot is running... Press Ctrl+C to stop.")
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot stopped.")

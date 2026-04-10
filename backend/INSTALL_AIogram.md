# Quick Bot Setup - Get Your Bot Talking!

## Step 1: Install aiogram
```bash
pip install aiogram
```

## Step 2: Get Your Bot Token
1. Message @BotFather on Telegram
2. `/newbot` - Create "Habesha Bingo 2.0"
3. Copy the bot token (looks like: 123456789:ABCDEF...)

## Step 3: Configure Your Bot
Edit `bot.py` and replace:
```python
TOKEN = "YOUR_BOT_TOKEN_HERE"
```
With:
```python
TOKEN = "123456789:ABCDEF..."
```

## Step 4: Run the Bot
```bash
python bot.py
```

## Step 5: Test It!
1. You should see: "Bot is running... Press Ctrl+C to stop."
2. Go to Telegram
3. Find your bot
4. Send `/start`
5. You should see the welcome message and phone button!

## What You'll See:
```
fire Welcome to Habesha Bingo! fire

bet Please verify your phone number to receive your **10 ETB** bonus. bet

Click the button below to get started:
[fire Verify Phone Number fire]
```

## Troubleshooting:
- **"Bot token is invalid"**: Check your token from @BotFather
- **"Bot is running" but no response**: Check internet connection
- **"Import error"**: Make sure aiogram is installed

## Next Steps:
Once this works, we'll add:
- Database integration
- Phone verification logic
- Balance tracking
- Game features

For now, just get this basic connection working!

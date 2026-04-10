# Habesha Bingo 2.0 - Quick Start Guide

## Step 1: Get Your Bot Running in 5 Minutes

### 1.1 Install Dependencies
```bash
cd backend
pip install -r simple_requirements.txt
```

### 1.2 Setup Environment
```bash
python setup_simple.py
```

### 1.3 Configure Your Bot
1. Go to [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot` - Create "Habesha Bingo 2.0"
3. Copy the bot token
4. Edit `.env` file:
```env
BOT_TOKEN=your_actual_bot_token_here
GULE_TEST_ID=your_telegram_id
```

### 1.4 Start the Bot
```bash
python simple_bot.py
```

### 1.5 Test It!
- Send `/start` to your bot
- Share your contact
- Try `/balance`
- Try `/invite`

## Step 2: Database Setup (Choose One)

### Option A: Supabase (Recommended - Free)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Get connection string
4. Update your code to use PostgreSQL instead of SQLite

### Option B: Render (Also Free)
1. Go to [render.com](https://render.com)
2. Create PostgreSQL database
3. Get connection string
4. Update database connection

### Option C: Local SQLite (For Testing)
- Already included in `simple_bot.py`
- Just run the setup script

## Step 3: Hosting (Choose One)

### Option A: PythonAnywhere (Free Tier)
1. Sign up at [pythonanywhere.com](https://pythonanywhere.com)
2. Create "Web" app
3. Upload your files
4. Install requirements
5. Set up web app to run your bot

### Option B: Railway.app (Free Tier)
1. Sign up at [railway.app](https://railway.app)
2. Connect your GitHub repo
3. Set environment variables
4. Deploy automatically

### Option C: VPS (More Control)
- DigitalOcean $5/month
- Vultr $3.50/month
- Install Python and run bot 24/7

## Step 4: Crypto Setup (Optional for Demo)

### NowPayments Setup
1. Sign up at [nowpayments.io](https://nowpayments.io)
2. Get API key
3. Add to environment variables
4. Test with small amounts

### For Demo/Testing
- The bot includes mock crypto functions
- You can test everything without real crypto
- Just comment out crypto calls

## Step 5: The "Gule" Stress Test

### Test These Scenarios:
1. **Fake Bingo Claim**: Try to claim bingo when you don't have it
2. **Overdraw**: Try to withdraw more than you have
3. **Self-Referral**: Try to refer yourself
4. **Double Bonus**: Try to get welcome bonus twice

### Expected Results:
- Bot should handle all errors gracefully
- No crashes or database corruption
- Clear error messages to users

## Step 6: Localize Amharic Content

### Update These Messages in `simple_bot.py`:
- Welcome messages
- Instructions
- Error messages
- Success notifications

### Add Amharic Flavor:
- Use "fire" emojis: "fire" "bet" "cash"
- Keep energy high and exciting
- Make it feel "Habesha"

## Current Status: Ready to Test! 

Your bot now has:
- Working `/start` command
- Working `/balance` command
- Phone verification
- 10 ETB welcome bonus
- Referral system
- Basic game loop
- Database integration

## Next Steps:
1. Test the bot thoroughly
2. Set up hosting
3. Add crypto integration
4. Localize content
5. Deploy to production

## Troubleshooting:

### Bot Token Issues:
- Make sure token is correct
- Check bot is not blocked by Telegram

### Database Issues:
- Check connection string
- Verify tables are created

### Hosting Issues:
- Check logs
- Verify environment variables
- Test locally first

## Support:
- Check logs for errors
- Test each component separately
- Start simple, add complexity gradually

You're ready to go! The bot should work immediately with the basic commands.

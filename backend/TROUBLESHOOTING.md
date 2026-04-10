# Habesha Bingo 2.0 - Emergency Troubleshooting Guide

## Problem: "Two Checkmarks" - Bot Not Responding

### Quick Diagnosis Checklist

#### 1. Check if Bot is Running
```bash
# Look for these signs:
# - Terminal shows "Bot is running..." message
# - No error messages in terminal
# - Cursor is on new line (not back at command prompt)

# If bot is NOT running:
python debug_main.py
```

#### 2. Check for Error Messages
```bash
# Look for these error patterns:
# - "Authentication Failed" -> Bot token is wrong
# - "Connection Timeout" -> Database connection issue
# - "KeyError: 'BOT_TOKEN'" -> Environment variable not set
# - "OperationalError" -> Database schema issue
```

#### 3. Test with Heartbeat
Send any non-command message (like "hello") to your bot.
- **If you see "fire I am alive! fire"** -> Connection is fine, logic has bug
- **If you see NOTHING** -> Bot isn't connecting to Telegram

#### 4. Run Debug Commands
Send these commands to your bot:
- `/ping` - Should respond with "Pong!"
- `/test` - Tests database connection

## Common Issues & Fixes

### Issue 1: Bot Token Problems
**Symptoms:**
- "Authentication Failed" in logs
- Bot doesn't start

**Fix:**
```bash
# 1. Get new token from @BotFather
# 2. Update .env file
BOT_TOKEN=your_new_token_here

# 3. Restart bot
python debug_main.py
```

### Issue 2: Database Connection Problems
**Symptoms:**
- "Connection Timeout" errors
- Bot hangs on database operations
- "Two checkmarks" but no response

**Fix:**
```bash
# 1. Check DATABASE_URL in .env
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/habesha_bingo

# 2. For Supabase, check:
# - IP is whitelisted (0.0.0.0/0)
# - Database URL format is correct
# - Connection pooling is enabled

# 3. Test database manually:
psql your_connection_string -c "SELECT 1;"
```

### Issue 3: Polling Conflicts
**Symptoms:**
- Multiple bot instances running
- Inconsistent responses
- "Two checkmarks" intermittently

**Fix:**
```bash
# 1. Close ALL terminal windows
# 2. Check for running processes:
ps aux | grep python

# 3. Kill any existing bot processes:
pkill -f "python.*main.py"

# 4. Start fresh:
python debug_main.py
```

### Issue 4: Environment Variable Issues
**Symptoms:**
- "BOT_TOKEN not set" errors
- "DATABASE_URL not set" errors
- Configuration not loading

**Fix:**
```bash
# 1. Check .env file exists:
ls -la .env

# 2. Check .env file contents:
cat .env

# 3. Verify variables are set:
echo $BOT_TOKEN
echo $DATABASE_URL

# 4. Recreate .env if needed:
cp .env.postgres .env
# Edit with actual values
```

## Debug Mode Features

### Enhanced Logging
The debug version includes:
- **DEBUG level logging** - More detailed output
- **File logging** - Saves to `bot_debug.log`
- **Console output** - Real-time viewing
- **Error tracking** - Detailed error messages

### Heartbeat Test
```python
# This handler catches ALL messages
@dp.message()
async def heartbeat(message: types.Message):
    print(f"Received message: {message.text}")
    await message.answer("fire I am alive! fire")
```

### Test Commands
- `/ping` - Basic connectivity test
- `/test` - Database connection test
- Any non-command text - Heartbeat response

## Step-by-Step Troubleshooting

### Step 1: Run Debug Version
```bash
python debug_main.py
```

### Step 2: Check Startup Messages
Look for these messages:
```
INFO - Bot Token: 123456789:A...
INFO - Database URL: postgresql+asyncpg://...
INFO - Bot connected: @your_bot_username
INFO - Starting bot polling...
```

### Step 3: Test Basic Commands
Send to your bot:
1. Type "hello" (should get "I am alive!")
2. Send `/ping` (should get "Pong!")
3. Send `/test` (should test database)

### Step 4: Check Logs
```bash
# View real-time logs
tail -f bot_debug.log

# Look for recent errors
grep ERROR bot_debug.log | tail -10
```

### Step 5: Identify the Problem

#### If heartbeat works but commands don't:
- Problem is in command logic
- Check database connection
- Look for specific command errors

#### If nothing works:
- Problem is bot connection
- Check bot token
- Check internet connection

## Common Error Messages & Solutions

### "Authentication Failed"
**Cause:** Wrong bot token
**Solution:** Get new token from @BotFather

### "Connection Timeout"
**Cause:** Database connection issue
**Solution:** Check DATABASE_URL and network

### "KeyError: 'BOT_TOKEN'"
**Cause:** Environment variable not loaded
**Solution:** Check .env file and python-dotenv

### "OperationalError: relation 'users' does not exist"
**Cause:** Database schema not created
**Solution:** Run schema.sql

### "asyncpg.exceptions.PostgresConnectionError"
**Cause:** PostgreSQL connection issue
**Solution:** Check database server and credentials

## Quick Fix Commands

### Reset Everything
```bash
# 1. Kill all python processes
pkill -f python

# 2. Clear logs
> bot_debug.log

# 3. Restart with debug version
python debug_main.py
```

### Test Database Only
```bash
# Test database connection directly
python -c "
import asyncpg
import asyncio

async def test():
    conn = await asyncpg.connect('your_connection_string')
    result = await conn.fetchval('SELECT 1')
    print(f'Database test: {result}')
    await conn.close()

asyncio.run(test())
"
```

### Test Bot Token Only
```bash
# Test bot token with curl
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/getMe"
```

## When to Ask for Help

If you've tried all above and still have issues, provide:

1. **Last 10 lines of terminal output**
2. **Contents of .env file** (hide sensitive data)
3. **Result of `/ping` command**
4. **Result of heartbeat test** (send "hello")
5. **Database connection test result**

## Prevention Tips

1. **Always use debug version** when troubleshooting
2. **Check logs first** before making changes
3. **Test one thing at a time**
4. **Keep backup of working version**
5. **Document your configuration**

---

**Remember:** The "Two Checkmarks" issue is almost always either:
1. Bot not running
2. Database connection hanging
3. Multiple bot instances conflicting

Use the debug version to identify which one it is!

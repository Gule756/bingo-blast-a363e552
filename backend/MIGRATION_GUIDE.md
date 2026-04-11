# SQLite to Supabase Migration Guide

## Problem Solved

Your bot had **two separate databases**:
- **SQLite**: `habesha_bingo_complete.db` (old users)
- **Supabase**: PostgreSQL (new users)

This caused users to "exist but not be visible" depending on which database you checked.

## Solution Overview

1. **Migrate all SQLite users to Supabase**
2. **Update bot to use Supabase only**
3. **Remove SQLite dependencies**
4. **Test everything works**

## Files Created

### 1. `migrate_to_supabase.py`
- Complete migration script
- Moves users and transactions
- Creates backup before migration
- Verifies migration success

### 2. `complete_bot_supabase.py`
- Updated bot using Supabase only
- All handlers use Database class
- No SQLite dependencies

### 3. `test_migration.py`
- Creates test data in SQLite
- Verifies environment setup
- Quick migration testing

## Step-by-Step Migration

### Step 1: Backup Current Data
```bash
cd backend
python test_migration.py
```

### Step 2: Run Migration
```bash
python migrate_to_supabase.py
```

### Step 3: Test New Bot
```bash
python complete_bot_supabase.py
```

### Step 4: Verify in Supabase Dashboard
- Check `users` table
- Verify all users migrated
- Test with `/start` command

## What Gets Migrated

### Users Table
- `telegram_id` (primary key)
- `username`, `phone_number`
- `deposited_balance`, `won_balance`
- `is_verified`, `bonus_claimed`
- `referral_count`, `referrer_id`
- `created_at`, `last_active`

### Transactions Table
- All transaction records
- Preserves timestamps
- Maintains user relationships

## Key Improvements

### Before (Split System)
```
SQLite Users: 150
Supabase Users: 25
Total Confusion: 175 users split across databases
```

### After (Unified System)
```
SQLite Users: 0 (archived)
Supabase Users: 175 (all users)
Total Clarity: Single source of truth
```

## Safety Features

### Automatic Backup
- Creates timestamped backup
- Preserves original SQLite file
- Can rollback if needed

### Duplicate Prevention
- Checks if user already exists in Supabase
- Skips migration for existing users
- Maintains data integrity

### Verification
- Compares user counts before/after
- Reports migration statistics
- Identifies any issues

## Post-Migration Steps

### 1. Update Environment
```bash
# Ensure .env has correct values
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
```

### 2. Replace Bot Files
```bash
# Backup old bot
mv complete_bot.py complete_bot_sqlite_backup.py

# Use new bot
mv complete_bot_supabase.py complete_bot.py
```

### 3. Test Critical Functions
- `/start` - User registration
- `/balance` - Balance display
- `/register` - Contact verification
- `/deposit` - Deposit handling

### 4. Monitor for Issues
- Check bot logs
- Verify user balances
- Test with old users

## Troubleshooting

### Migration Fails
1. Check DATABASE_URL in .env
2. Verify Supabase connection
3. Check SQLite file exists
4. Review error logs

### Users Missing
1. Run verification step
2. Check skipped users
3. Manually verify in Supabase
4. Re-run migration if needed

### Bot Errors
1. Check database initialization
2. Verify environment variables
3. Review bot logs
4. Test with new user

## Benefits of Migration

### Single Source of Truth
- All users in one database
- Consistent data across system
- No split balances

### Better Performance
- Supabase handles scaling
- Better query performance
- Real-time capabilities

### Future Proof
- Easy to add new features
- Cloud-based reliability
- Built-in backups

## Migration Time Estimate

- **Small database** (<100 users): 5-10 minutes
- **Medium database** (100-1000 users): 10-30 minutes
- **Large database** (>1000 users): 30+ minutes

## Support

If you encounter issues:
1. Check error messages
2. Verify environment setup
3. Review Supabase connection
4. Test with sample data

## Success Indicators

Migration is successful when:
- All SQLite users appear in Supabase
- Bot works with migrated users
- No SQLite dependencies remain
- User balances are correct

# Telegram Bot Integration Guide

This document explains how the Habesha Bingo game integrates with Telegram bot commands.

## Overview

The game supports full Telegram bot integration with the following commands:
- `/start` - Start or return to main menu
- `/register` - Create your account
- `/play` - Start a new game
- `/balance` - Check your balance and transactions
- `/deposit` - Add funds to your account
- `/withdraw` - Withdraw your winnings
- `/transfer` - Send funds to other players
- `/invite` - Invite friends and earn bonuses
- `/instructions` - How to play
- `/cancel` - Cancel current action
- `/help` - Show help message

## Architecture

### 1. Bot Command Handler (`supabase/functions/telegram-bot/index.ts`)

This Supabase Edge Function handles all Telegram bot commands and webhook updates.

**Features:**
- Command routing and parsing
- User registration and verification
- Balance management
- Transaction handling
- Referral system
- Inline keyboard generation

**Environment Variables Required:**
```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
MINI_APP_URL=https://your-domain.com
```

### 2. Mini App Integration (`src/lib/telegram.ts`)

Extended Telegram WebApp utilities for deep linking and command handling.

**Key Functions:**
- `getStartParam()` - Get start parameters from deep links
- `getCurrentAction()` - Parse URL parameters for actions
- `navigateToAction()` - Navigate within the Mini App
- `executeBotCommand()` - Send commands back to bot

### 3. Bot Command Handler Component (`src/components/game/BotCommandHandler.tsx`)

React component that processes bot commands in the Mini App context.

**Features:**
- Automatic navigation based on bot commands
- Integration with game state management
- Real-time command processing

## Deep Linking

The Mini App supports deep linking through Telegram's start parameters:

### Format:
```
https://t.me/your_bot?start=action_play&userId=123
```

### Supported Actions:
- `action=play&userId=123` - Open game lobby
- `action=balance&userId=123` - Show balance screen
- `action=deposit&userId=123` - Open deposit screen
- `action=withdraw&userId=123` - Open withdrawal screen
- `action=transfer&userId=123` - Open transfer screen
- `action=invite&userId=123` - Show invite options
- `action=instructions&userId=123` - Show game instructions

### Referral Links:
```
https://t.me/your_bot?start=ref_123456
```

Where `123456` is the Telegram user ID of the referrer.

## Web App URLs

Bot commands use Web App buttons to open the Mini App with specific actions:

```typescript
// Example from bot handler
{
  text: 'Play Now',
  web_app: { 
    url: `${getMiniAppUrl()}?action=play&userId=${player.id}` 
  }
}
```

## Database Schema

### New Tables:

#### `transactions`
- `id` - UUID primary key
- `player_id` - Foreign key to players table
- `type` - Transaction type (deposit, withdraw, transfer_in, transfer_out)
- `amount` - Transaction amount
- `status` - Transaction status (pending, completed, failed)
- `payment_method` - Payment method used
- `reference_id` - External reference ID
- `description` - Transaction description
- `created_at` - Timestamp
- `updated_at` - Last update timestamp

#### Updated `players` table:
- `games_played` - Total games played counter
- `referred_by` - Telegram ID of referrer
- `referral_bonus_earned` - Total referral bonuses earned

## Setup Instructions

### 1. Deploy Bot Command Handler

```bash
# Deploy the telegram-bot function
supabase functions deploy telegram-bot
```

### 2. Set Environment Variables

```bash
# Set required environment variables
supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token
supabase secrets set TELEGRAM_BOT_USERNAME=your_bot_username
supabase secrets set MINI_APP_URL=https://your-domain.com
```

### 3. Configure Bot Webhook

```bash
# Set webhook for your bot
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://<project-ref>.supabase.co/functions/v1/telegram-bot"}'
```

### 4. Run Database Migration

```bash
# Apply database migrations
supabase db push
```

## Testing Commands

### Test Deep Links:
1. Create a test link: `https://t.me/your_bot?start=action_play&userId=test`
2. Click the link in Telegram
3. Verify the Mini App opens to the correct screen

### Test Bot Commands:
1. Send `/start` to your bot
2. Verify the welcome message and keyboard
3. Test each command individually

### Test Web App Integration:
1. Use bot commands that open Web App
2. Verify the Mini App opens with correct parameters
3. Test navigation between different screens

## Security Features

### 1. Contact Verification
- Validates that shared contact belongs to the same user
- Prevents contact spoofing attacks
- Uses Telegram's built-in verification

### 2. Transaction Security
- Row Level Security (RLS) on transactions table
- Users can only access their own data
- Audit trail for all financial operations

### 3. Referral System
- Prevents self-referral
- Validates referrer exists
- Tracks referral bonuses accurately

## Error Handling

### Bot Command Errors:
- Invalid commands return help message
- Missing user data prompts for registration
- Insufficient balance shows appropriate error

### Mini App Errors:
- Network failures show retry options
- Invalid parameters redirect to welcome screen
- Authentication errors trigger re-verification

## Monitoring

### Key Metrics to Track:
- Command usage frequency
- Conversion rates (registration to deposit)
- Transaction success rates
- Referral program effectiveness

### Logging:
- All bot interactions logged
- Transaction attempts recorded
- Error events captured for debugging

## Future Enhancements

### Planned Features:
- `/stats` - View detailed game statistics
- `/leaderboard` - Show top players
- `/tournaments` - Join special tournaments
- `/notifications` - Manage notification preferences

### API Improvements:
- Real-time balance updates
- Push notifications for game events
- Advanced analytics dashboard

## Support

For issues with the Telegram bot integration:
1. Check Supabase function logs
2. Verify bot token and webhook configuration
3. Test Mini App deep linking separately
4. Review database migration status

## Examples

### Bot Command Flow:
```
User: /deposit
Bot: "Choose deposit amount:" [50 ETB] [100 ETB] [Custom]
User: [100 ETB]
Bot: Opens Mini App with ?action=deposit&userId=123&amount=100
Mini App: Shows deposit screen with pre-filled amount
```

### Referral Flow:
```
User A: /invite
Bot: "Share this link: https://t.me/bot?start=ref_A123"
User B: Clicks referral link
Mini App: Opens with ?action=register&ref=A123
User B: Registers and deposits
Bot: Awards 10 ETB bonus to User A
```

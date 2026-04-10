# Habesha Bingo 2.0 - Crypto Setup Guide

## Crypto-Native Features Implemented

### 1. Simplified Crypto Deposit (/deposit)
- **Multi-currency support**: USDT (TRC20), TON, BTC
- **Live rate conversion**: 1 USDT = 150 ETB (current market rate)
- **Unique addresses**: Generated per user per currency
- **Automatic balance updates**: After 1 network confirmation

### 2. Advanced Withdrawal (/withdraw)
- **Instant processing**: Under 500 ETB processed automatically
- **Verification checks**: 50% deposit rule, 100 ETB minimum
- **Crypto display**: Shows USDT equivalent value
- **Multi-currency support**: USDT (TRC20) and TON withdrawals

### 3. Crypto-Native Referral (/invite)
- **Base bonus**: 2 ETB for every friend who joins
- **Crypto bonus**: Extra 5 ETB if friend deposits > $5
- **Airdrop terminology**: Modern crypto-friendly language
- **Play-only balance**: Encourages continued play

### 4. Live Balance (/balance)
- **Crypto value display**: Shows USDT equivalent
- **Current rate**: 1 USDT = 150 ETB
- **Balance breakdown**: Winnings vs bonus funds
- **Real-time updates**: Reflects crypto deposits

### 5. Crypto Help (/help_crypto)
- **P2P guidance**: How to buy USDT on Binance
- **Network explanation**: What TRC20 means
- **Security warnings**: Send to correct network only
- **Support contact**: Help for crypto beginners

## Quick Setup

### Step 1: Install Requirements
```bash
pip install -r crypto_requirements.txt
```

### Step 2: Configure Bot
1. Get bot token from @BotFather
2. Edit `crypto_bot.py`:
```python
TOKEN = "YOUR_BOT_TOKEN_HERE"
```

### Step 3: Start Bot
```bash
python crypto_bot.py
```

### Step 4: Test Commands
- `/start` - Registration with crypto features
- `/deposit` - Multi-currency deposit options
- `/balance` - Live balance with USDT value
- `/withdraw` - Advanced withdrawal with checks
- `/invite` - Crypto referral program
- `/help_crypto` - Crypto education

## Crypto Features in Action

### Deposit Flow:
1. User sends `/deposit`
2. Bot shows currency options (USDT, TON, BTC)
3. User selects currency
4. Bot generates unique address
5. User sends crypto to address
6. Bot detects deposit and converts to ETB
7. Balance updates automatically

### Withdrawal Flow:
1. User sends `/withdraw`
2. Bot shows withdrawable balance in ETB + USDT
3. User enters amount and wallet address
4. Bot verifies 50% rule and minimum
5. Instant processing for amounts < 500 ETB
6. Crypto sent to user's wallet

### Referral Flow:
1. User sends `/invite`
2. Bot generates referral link
3. Friend joins and deposits
4. Base 2 ETB bonus credited
5. If deposit > $5, extra 5 ETB bonus
6. All earnings go to play-only balance

## Database Schema

### New Tables:
- `crypto_transactions` - All crypto operations
- `deposit_addresses` - Unique addresses per user
- `crypto_referrals` - Enhanced referral tracking

### Enhanced Fields:
- All transactions track currency and ETB conversion
- Deposit addresses are unique per user/currency
- Referrals track deposit amounts for bonus calculation

## Security Features

### Deposit Security:
- Unique addresses prevent mixing
- Network validation (TRC20 only for USDT)
- Confirmation requirement before credit

### Withdrawal Security:
- 50% deposit rule enforcement
- Minimum withdrawal limits
- Instant processing only for small amounts
- Manual review for large withdrawals

### Referral Security:
- Phone verification required
- Self-referral prevention
- Deposit verification for bonus payment

## Rate Management

### Current Rate: 150 ETB per USDT
- Based on current Ethiopian market
- Can be updated in bot configuration
- Used for all conversions

### Rate Updates:
- Manual: Change `CURRENT_USDT_ETB_RATE` in code
- Automatic: Can integrate with rate API (future)
- Display: Shows current rate in balance command

## Future Enhancements

### Telegram Wallet Integration:
- Direct payment within Telegram
- No copy/paste required
- Faster user experience

### Advanced Rate API:
- Real-time rate updates
- Multiple exchange sources
- Rate history tracking

### Enhanced Security:
- 2FA for withdrawals
- Transaction limits
- Anti-money laundering checks

## Testing the Crypto Features

### Test Deposit:
1. Send `/deposit`
2. Select USDT
3. Copy the generated address
4. Send small test amount (0.1 USDT)
5. Wait for confirmation
6. Check `/balance` for update

### Test Withdrawal:
1. Ensure you have > 100 ETB withdrawable
2. Send `/withdraw`
3. Enter amount < 500 ETB
4. Provide your USDT wallet address
5. Check for instant processing

### Test Referral:
1. Send `/invite`
2. Share link with friend
3. Friend joins and deposits > $5
4. Check for 7 ETB total bonus (2 + 5)

## Production Considerations

### Crypto API Integration:
- Replace mock address generation
- Integrate with real crypto APIs
- Set up proper wallet infrastructure

### Rate Management:
- Implement automatic rate updates
- Add rate change notifications
- Consider rate volatility

### Compliance:
- KYC procedures for large amounts
- Transaction monitoring
- Regulatory compliance

## User Experience

### Crypto-Friendly Language:
- "Airdrop" instead of "bonus"
- "Gas fee" terminology
- Modern crypto references

### Educational Content:
- Help for crypto beginners
- Network explanations
- Security best practices

### Seamless Integration:
- Crypto feels native to the game
- No complex crypto knowledge required
- Smooth ETB conversion

This crypto-native approach positions Habesha Bingo 2.0 as a modern, competitive gaming platform that leverages cryptocurrency for fast, secure, and automated financial operations.

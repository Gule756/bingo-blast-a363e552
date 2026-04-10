# Habesha Bingo 2.0 - Backend Server

Server-authoritative multiplayer bingo backend with Telegram bot integration and crypto payments.

## Features

- **Server-Authoritative Game Engine**: Global game state management with anti-cheat
- **Real-time WebSocket**: Live game updates and number calling
- **Telegram Bot Integration**: Complete bot with all commands
- **Crypto Payments**: USDT (TRC20) and TON support
- **Referral System**: 2 ETB per referral, max 20 referrals
- **Security**: Phone verification, bonus prevention, atomic transactions
- **Database**: PostgreSQL with proper indexing and constraints

## Architecture

```
Backend (Python)
    FastAPI (REST API + WebSocket)
    aiogram (Telegram Bot)
    SQLAlchemy (ORM)
    PostgreSQL (Database)
    AsyncIO (Concurrency)
```

## Quick Start

### 1. Setup Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup Database

```bash
# Create database
createdb habesha_bingo

# Run migration
psql habesha_bingo < migrations/001_initial_schema.sql
```

### 4. Start Server

```bash
python run.py
```

The server will start on `http://localhost:8000`

## Configuration

### Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
- `TELEGRAM_BOT_USERNAME`: Your bot's username
- `MINI_APP_URL`: URL to your Telegram Mini App

### Optional Variables

- `NOWPAYMENTS_API_KEY`: For USDT payments
- `TON_API_KEY`: For TON payments
- `GULE_TEST_ACCOUNT_ID`: Gule's Telegram ID for testing

## API Endpoints

### Authentication
- `POST /api/auth/telegram` - Authenticate via Telegram WebApp
- `POST /api/verify-contact` - Verify phone number

### User Management
- `GET /api/user/{user_id}/balance` - Get user balance
- `POST /api/deposit/generate-address` - Generate deposit address
- `POST /api/withdraw/request` - Request withdrawal

### WebSocket
- `WS /ws/{user_id}` - Real-time game updates

## Telegram Bot Commands

- `/start` - Start or return to main menu
- `/register` - Register account
- `/balance` - Check balance and transactions
- `/deposit` - Add funds (USDT/TON)
- `/withdraw` - Withdraw winnings
- `/invite` - Generate referral link
- `/instructions` - Game rules
- `/help` - Show help
- `/cancel` - Cancel action

## Game Flow

1. **Lobby (30s)**: Users select 1-3 cards
2. **Warning (5s)**: Registration closes
3. **Active Game**: Numbers called every 3s
4. **Winner Selection**: First valid bingo wins
5. **Payout**: 90% to winner, 10% house edge

## Security Features

- **Phone Verification**: Prevents duplicate accounts
- **Bonus Prevention**: Each phone gets welcome bonus once
- **50% Rule**: Withdrawals limited by deposit history
- **Atomic Transactions**: Prevents double-spending
- **Server Validation**: All bingo patterns checked server-side

## Database Schema

### Key Tables

- `users`: User accounts and balances
- `games`: Game sessions and state
- `transactions`: Financial transactions
- `bingo_cards`: 400 cards per game (1-400)
- `referrals`: Referral tracking

### Balance System

- `won_balance`: Withdrawable winnings
- `deposited_balance`: Play-only (deposits + bonuses)
- `total_balance`: Combined balance

## Crypto Integration

### Supported Currencies

- **USDT (TRC20)**: TRON network
- **TON**: TON network

### Conversion

- Real-time ETB conversion rates
- Automatic balance crediting
- Withdrawal processing

## Monitoring

### Health Check

```bash
curl http://localhost:8000/health
```

### Logs

```bash
tail -f habesha_bingo.log
```

## Development

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black .
flake8 .
```

### Database Migrations

```bash
# Create new migration
# Add SQL file to migrations/ directory

# Apply migration
psql habesha_bingo < migrations/001_initial_schema.sql
```

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "run.py"]
```

### Environment Setup

1. Set PostgreSQL connection
2. Configure bot token
3. Set Mini App URL
4. Configure crypto APIs (optional)

## Troubleshooting

### Common Issues

1. **Database Connection**: Check DATABASE_URL format
2. **Bot Token**: Verify token from @BotFather
3. **WebSocket**: Ensure proper CORS configuration
4. **Crypto**: Test with mock addresses first

### Debug Mode

Set `DEBUG=true` in `.env` for detailed logging.

## Game Rules

### Card Layout
- 5x5 grid with B-I-N-G-O columns
- B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
- Center square (N[2][2]) is always FREE

### Winning Patterns
- Horizontal: 5 in a row
- Vertical: 5 in a column
- Diagonal: 5 diagonal
- Corners: 4 corner squares
- Full House: All 24 numbers

### Anti-Cheat
- Server validates all bingo claims
- False claims result in disconnection
- System bot can win (10% chance)

## Support

For issues:
1. Check logs for errors
2. Verify environment variables
3. Test database connection
4. Validate bot token

## License

Proprietary - Habesha Bingo 2.0

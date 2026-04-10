# Habesha Bingo 2.0 - Complete Setup Guide

## Overview

Habesha Bingo 2.0 is a **server-authoritative multiplayer bingo game** with Telegram Mini App integration, crypto payments (USDT/TON), and real-time gameplay. This guide covers the complete setup from backend to frontend.

## Architecture

```
Frontend (React/Next.js)  <--->  Backend (Python/FastAPI)
       |                           |
    WebSocket                 WebSocket
       |                           |
Telegram Mini App  <--->  Telegram Bot (aiogram)
       |                           |
   Crypto Payments  <--->  Database (PostgreSQL)
```

## Prerequisites

### Required Software
- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 14+**
- **Redis** (optional, for caching)
- **Git**

### Required Accounts
- **Telegram Bot Token** from @BotFather
- **PostgreSQL database**
- **Domain for Mini App** (HTTPS required)

## Backend Setup

### 1. Create Backend Directory

```bash
mkdir habesha-bingo-backend
cd habesha-bingo-backend
```

### 2. Install Dependencies

```bash
# Copy all backend files from the project
# Or create them manually based on the provided files

# Install Python requirements
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Required `.env` variables:**
```env
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/habesha_bingo
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username
MINI_APP_URL=https://your-domain.com
SECRET_KEY=your-super-secret-key-here
GULE_TEST_ACCOUNT_ID=123456789
DEBUG=false
```

### 4. Setup Database

```bash
# Create database
createdb habesha_bingo

# Run migration
psql habesha_bingo < migrations/001_initial_schema.sql
```

### 5. Test Backend

```bash
# Start server
python run.py
```

Backend should start on `http://localhost:8000`

### 6. Verify Health Check

```bash
curl http://localhost:8000/health
```

## Frontend Setup

### 1. Update Environment Variables

```bash
# In frontend directory
cp .env.example .env

# Add backend URL
echo "VITE_API_BASE_URL=http://localhost:8000" >> .env
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Frontend

```bash
npm run dev
```

Frontend should start on `http://localhost:5173`

## Telegram Bot Setup

### 1. Create Bot

1. Message @BotFather on Telegram
2. `/newbot` - Create new bot
3. Set name: "Habesha Bingo 2.0"
4. Set username: unique username
5. Copy the bot token

### 2. Configure Bot Commands

```python
# In bot_handler.py, the commands are already configured:
# /start, /register, /balance, /deposit, /withdraw, /invite, /instructions, /help, /cancel
```

### 3. Set Webhook (Optional)

For production, set webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d '{"url": "https://your-domain.com/api/telegram/webhook"}'
```

For development, polling is used automatically.

## Telegram Mini App Setup

### 1. Create Mini App

1. Go to [@BotFather](https://t.me/BotFather)
2. `/mybots` -> Select your bot
3. "Bot Settings" -> "Menu Button"
4. Set Mini App URL

### 2. Configure Mini App

In your bot's settings:
- Set Mini App URL to your frontend domain
- Enable inline mode
- Configure privacy settings

### 3. Test Mini App

1. Open your bot in Telegram
2. Click the menu button
3. Mini App should open

## Crypto Payment Setup

### 1. USDT (TRC20) Setup

```bash
# Get NowPayments API key (optional for demo)
# Add to .env:
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
```

### 2. TON Setup

```bash
# Get TON API key (optional for demo)
# Add to .env:
TON_API_KEY=your_ton_api_key
```

### 3. Test Crypto Payments

The system includes mock implementations for testing. For production:
- Replace mock functions in `crypto_service.py`
- Use real blockchain APIs
- Set up proper wallet infrastructure

## Database Setup

### 1. PostgreSQL Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb habesha_bingo
sudo -u postgres createuser --interactive
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
createdb habesha_bingo
```

**Windows:**
- Download and install PostgreSQL
- Use pgAdmin to create database

### 2. Database Configuration

```sql
-- Create user (optional)
CREATE USER habesha_bingo WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE habesha_bingo TO habesha_bingo;

-- Run migration
\i migrations/001_initial_schema.sql
```

### 3. Verify Database

```bash
psql habesha_bingo -c "\dt"
```

Should show tables: users, games, transactions, etc.

## Testing the System

### 1. Test Backend

```bash
# Health check
curl http://localhost:8000/health

# Test authentication (requires Telegram data)
curl -X POST http://localhost:8000/api/auth/telegram \
     -H "Content-Type: application/json" \
     -d '{"init_data": "...", "user": {...}}'
```

### 2. Test Telegram Bot

1. Send `/start` to your bot
2. Share contact for verification
3. Try `/balance` command
4. Test `/invite` command

### 3. Test Mini App

1. Open bot in Telegram
2. Click menu button
3. Should see welcome screen
4. Complete verification
5. Navigate to game lobby

### 4. Test Game Flow

1. Select stake amount
2. Choose 1-3 bingo cards
3. Wait for game to start
4. Numbers should be called every 3 seconds
5. Test bingo claiming

## Production Deployment

### 1. Backend Deployment

**Docker (Recommended):**
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "run.py"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/habesha_bingo
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=habesha_bingo
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 2. Frontend Deployment

**Vercel/Netlify:**
1. Connect repository
2. Set environment variables
3. Deploy automatically

**Self-hosted:**
```bash
npm run build
npm run preview
```

### 3. Domain Setup

1. Configure DNS for your domain
2. Set up SSL certificate (Let's Encrypt)
3. Configure reverse proxy (nginx)

### 4. Security

1. Set up firewall
2. Configure HTTPS
3. Secure database connections
4. Monitor logs

## Monitoring and Maintenance

### 1. Health Monitoring

```bash
# Backend health
curl https://your-domain.com/health

# Database status
psql habesha_bingo -c "SELECT COUNT(*) FROM users;"
```

### 2. Log Monitoring

```bash
# Backend logs
tail -f habesha_bingo.log

# System logs
journalctl -u habesha-bingo
```

### 3. Performance Monitoring

- Monitor WebSocket connections
- Track game performance
- Database query optimization
- Error rate tracking

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check credentials

**2. Bot Token Invalid**
- Verify token from @BotFather
- Check token format (no spaces)

**3. WebSocket Connection Failed**
- Check CORS configuration
- Verify backend is running
- Check firewall settings

**4. Mini App Not Loading**
- Verify HTTPS is enabled
- Check Mini App URL in bot settings
- Verify domain is whitelisted

### Debug Mode

Set `DEBUG=true` in `.env` for detailed logging.

### Support

For issues:
1. Check logs for errors
2. Verify environment variables
3. Test components individually
4. Check network connectivity

## Security Considerations

### 1. Authentication
- Telegram WebApp validation
- Phone number verification
- Session management

### 2. Financial Security
- Atomic transactions
- Balance validation
- Withdrawal limits

### 3. Game Security
- Server-authoritative validation
- Anti-cheat mechanisms
- Fair random number generation

### 4. Data Protection
- GDPR compliance
- Data encryption
- Access controls

## Scaling

### 1. Database Scaling
- Read replicas
- Connection pooling
- Query optimization

### 2. Application Scaling
- Load balancing
- Horizontal scaling
- Caching layer

### 3. WebSocket Scaling
- Redis adapter
- Multiple instances
- Connection management

## Conclusion

Habesha Bingo 2.0 is now ready for production! The system includes:

- **Server-authoritative game engine**
- **Real-time multiplayer gameplay**
- **Telegram bot integration**
- **Crypto payment support**
- **Comprehensive security**
- **Scalable architecture**

Start with testing in development, then deploy to production following the deployment guide. Good luck!

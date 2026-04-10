from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import uuid

from database import get_db, Database
from models import User, Game, Transaction, GameState, BingoCard
from game_engine import GameEngine, GameRoom
from bot_handler import TelegramBotHandler
from crypto_service import CryptoService
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
game_engine: GameEngine = None
bot_handler: TelegramBotHandler = None
crypto_service: CryptoService = None
db: Database = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global game_engine, bot_handler, crypto_service, db
    
    logger.info("Starting Habesha Bingo 2.0 Backend...")
    
    # Initialize database
    db = Database()
    await db.initialize()
    
    # Initialize services
    crypto_service = CryptoService()
    game_engine = GameEngine(db)
    bot_handler = TelegramBotHandler(db, crypto_service, game_engine)
    
    # Start bot and game engine
    await bot_handler.start()
    await game_engine.start()
    
    logger.info("Backend started successfully!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down backend...")
    await game_engine.stop()
    await bot_handler.stop()
    await db.close()
    logger.info("Backend shutdown complete.")

app = FastAPI(
    title="Habesha Bingo 2.0 API",
    description="Server-Authoritative Multiplayer Bingo Backend",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # room_id -> list of connections
        self.user_connections: Dict[WebSocket, str] = {}  # connection -> user_id
        self.connection_rooms: Dict[WebSocket, str] = {}  # connection -> room_id

    async def connect(self, websocket: WebSocket, user_id: str, room_id: str):
        await websocket.accept()
        
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        
        self.active_connections[room_id].append(websocket)
        self.user_connections[websocket] = user_id
        self.connection_rooms[websocket] = room_id
        
        logger.info(f"User {user_id} connected to room {room_id}")

    def disconnect(self, websocket: WebSocket):
        user_id = self.user_connections.get(websocket)
        room_id = self.connection_rooms.get(websocket)
        
        if room_id and room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        
        self.user_connections.pop(websocket, None)
        self.connection_rooms.pop(websocket, None)
        
        logger.info(f"User {user_id} disconnected from room {room_id}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except:
            # Connection might be closed
            self.disconnect(websocket)

    async def broadcast_to_room(self, message: str, room_id: str):
        if room_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_text(message)
                except:
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for connection in disconnected:
                self.disconnect(connection)

manager = ConnectionManager()

# API Routes
@app.get("/")
async def root():
    return {"message": "Habesha Bingo 2.0 Backend API", "version": "2.0.0"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "game_engine_running": game_engine.is_running() if game_engine else False,
        "active_rooms": len(manager.active_connections),
        "total_connections": len(manager.user_connections)
    }

@app.post("/api/auth/telegram")
async def telegram_auth(init_data: dict, db=Depends(get_db)):
    """Authenticate user via Telegram WebApp"""
    try:
        # Validate Telegram init data (implement validation)
        user_data = init_data.get('user', {})
        telegram_id = user_data.get('id')
        
        if not telegram_id:
            raise HTTPException(status_code=400, detail="Invalid Telegram user data")
        
        # Get or create user
        user = await db.get_user_by_telegram_id(telegram_id)
        if not user:
            user = await db.create_user(
                telegram_id=telegram_id,
                first_name=user_data.get('first_name', ''),
                last_name=user_data.get('last_name', ''),
                username=user_data.get('username', '')
            )
        
        # Check for Gule test account
        if telegram_id == settings.GULE_TEST_ACCOUNT_ID:
            await db.update_user_balance(user.id, won_balance=1000000)
            user.is_verified = True
            user.god_mode = True
            await db.update_user(user.id, is_verified=True, god_mode=True)
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "telegram_id": user.telegram_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "won_balance": user.won_balance,
                "deposited_balance": user.deposited_balance,
                "is_verified": user.is_verified,
                "god_mode": user.god_mode
            }
        }
    
    except Exception as e:
        logger.error(f"Telegram auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@app.post("/api/verify-contact")
async def verify_contact(telegram_id: int, phone_number: str, db=Depends(get_db)):
    """Verify user contact and give welcome bonus"""
    try:
        user = await db.get_user_by_telegram_id(telegram_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if phone already exists
        existing_user = await db.get_user_by_phone(phone_number)
        if existing_user and existing_user.id != user.id:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        # Update user
        await db.update_user(user.id, phone=phone_number, is_verified=True)
        
        # Give welcome bonus if not already claimed
        if not user.welcome_bonus_claimed:
            await db.update_user_balance(user.id, deposited_balance=10)
            await db.update_user(user.id, welcome_bonus_claimed=True)
            
            # Create transaction record
            await db.create_transaction(
                user_id=user.id,
                type="welcome_bonus",
                amount=10,
                status="completed"
            )
        
        return {"success": True, "message": "Contact verified successfully"}
    
    except Exception as e:
        logger.error(f"Contact verification error: {e}")
        raise HTTPException(status_code=500, detail="Verification failed")

@app.get("/api/user/{user_id}/balance")
async def get_user_balance(user_id: str, db=Depends(get_db)):
    """Get user balance breakdown"""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get transaction history
        transactions = await db.get_user_transactions(user_id, limit=10)
        
        return {
            "won_balance": user.won_balance,
            "deposited_balance": user.deposited_balance,
            "total_balance": user.won_balance + user.deposited_balance,
            "transactions": [
                {
                    "type": tx.type,
                    "amount": tx.amount,
                    "status": tx.status,
                    "created_at": tx.created_at.isoformat()
                }
                for tx in transactions
            ]
        }
    
    except Exception as e:
        logger.error(f"Balance fetch error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch balance")

@app.post("/api/deposit/generate-address")
async def generate_deposit_address(user_id: str, currency: str, db=Depends(get_db)):
    """Generate crypto deposit address"""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if currency not in ["USDT", "TON"]:
            raise HTTPException(status_code=400, detail="Unsupported currency")
        
        address = await crypto_service.generate_deposit_address(user_id, currency)
        
        return {
            "success": True,
            "address": address,
            "currency": currency,
            "instructions": f"Send {currency} to this address. Your account will be credited after 1 confirmation."
        }
    
    except Exception as e:
        logger.error(f"Deposit address generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate address")

@app.post("/api/withdraw/request")
async def request_withdrawal(user_id: str, amount: float, currency: str, wallet_address: str, db=Depends(get_db)):
    """Request withdrawal"""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validation rules
        if amount < 100:
            raise HTTPException(status_code=400, detail="Minimum withdrawal is 100 ETB")
        
        if user.won_balance < amount:
            raise HTTPException(status_code=400, detail="Insufficient withdrawable balance")
        
        # 50% rule check
        total_deposits = await db.get_total_deposits(user_id)
        if total_deposits < (amount * 0.5):
            raise HTTPException(status_code=400, detail="Total deposits must be at least 50% of withdrawal amount")
        
        # Create withdrawal request
        withdrawal = await db.create_transaction(
            user_id=user_id,
            type="withdrawal",
            amount=amount,
            status="pending",
            wallet_address=wallet_address,
            currency=currency
        )
        
        # Process withdrawal via crypto service
        result = await crypto_service.process_withdrawal(withdrawal.id, amount, currency, wallet_address)
        
        return {
            "success": True,
            "withdrawal_id": withdrawal.id,
            "status": result.get("status", "pending"),
            "message": "Withdrawal request submitted successfully"
        }
    
    except Exception as e:
        logger.error(f"Withdrawal request error: {e}")
        raise HTTPException(status_code=500, detail="Withdrawal request failed")

# WebSocket endpoints
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """Main WebSocket connection for game updates"""
    await manager.connect(websocket, user_id, "lobby")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "join_room":
                room_id = message["room_id"]
                await manager.connect(websocket, user_id, room_id)
                
                # Send current game state
                game_state = await game_engine.get_game_state(room_id)
                if game_state:
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "game_state",
                            "data": game_state
                        }),
                        websocket
                    )
            
            elif message["type"] == "select_cards":
                room_id = message["room_id"]
                card_ids = message["card_ids"]
                
                result = await game_engine.select_cards(user_id, room_id, card_ids)
                await manager.send_personal_message(
                    json.dumps({
                        "type": "cards_selected",
                        "data": result
                    }),
                    websocket
                )
            
            elif message["type"] == "claim_bingo":
                room_id = message["room_id"]
                
                result = await game_engine.claim_bingo(user_id, room_id)
                
                # Broadcast result to all players in room
                await manager.broadcast_to_room(
                    json.dumps({
                        "type": "bingo_claim",
                        "data": result
                    }),
                    room_id
                )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

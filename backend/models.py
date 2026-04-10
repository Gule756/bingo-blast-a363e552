from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    username = Column(String(50), nullable=True, unique=True)
    
    # Balances
    won_balance = Column(Float, default=0.0)  # Withdrawable
    deposited_balance = Column(Float, default=0.0)  # Play only (deposits + bonuses)
    
    # Status
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    god_mode = Column(Boolean, default=False)  # For Gule test account
    
    # Referral system
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    referral_count = Column(Integer, default=0)
    welcome_bonus_claimed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="user")
    game_players = relationship("GamePlayer", back_populates="user")
    referred_users = relationship("User", backref="referrer", remote_side=[id])

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Transaction details
    type = Column(String(50), nullable=False)  # deposit, withdraw, win, welcome_bonus, referral_bonus
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="ETB")
    status = Column(String(20), default="pending")  # pending, completed, failed
    
    # Crypto details
    crypto_currency = Column(String(10), nullable=True)  # USDT, TON
    crypto_address = Column(Text, nullable=True)
    tx_hash = Column(Text, nullable=True)
    confirmations = Column(Integer, default=0)
    
    # Metadata
    description = Column(Text, nullable=True)
    metadata = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="transactions")

class Game(Base):
    __tablename__ = "games"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(String(50), unique=True, nullable=False, index=True)
    
    # Game configuration
    stake_amount = Column(Float, nullable=False)
    max_players = Column(Integer, default=200)
    house_edge = Column(Float, default=0.10)  # 10%
    
    # Game state
    state = Column(String(20), default="lobby")  # lobby, warning, active, finished
    current_number = Column(Integer, nullable=True)
    called_numbers = Column(ARRAY(Integer), default=[])
    
    # Timing
    lobby_start = Column(DateTime, default=datetime.utcnow)
    lobby_end = Column(DateTime, nullable=True)
    game_start = Column(DateTime, nullable=True)
    game_end = Column(DateTime, nullable=True)
    
    # Winner
    winner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    winning_pattern = Column(String(50), nullable=True)  # horizontal, vertical, diagonal, corners, full_house
    winning_cards = Column(ARRAY(Integer), default=[])
    
    # Pot
    total_pot = Column(Float, default=0.0)
    house_cut = Column(Float, default=0.0)
    
    # System bot (dummy player)
    is_system_winner = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    winner = relationship("User")
    players = relationship("GamePlayer", back_populates="game")
    cards = relationship("BingoCard", back_populates="game")

class GamePlayer(Base):
    __tablename__ = "game_players"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Player state
    cards_selected = Column(ARRAY(Integer), default=[])
    is_active = Column(Boolean, default=True)
    final_position = Column(Integer, nullable=True)  # 1st, 2nd, 3rd, etc.
    
    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    
    # Relationships
    game = relationship("Game", back_populates="players")
    user = relationship("User", back_populates="game_players")

class BingoCard(Base):
    __tablename__ = "bingo_cards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id"), nullable=False)
    card_number = Column(Integer, nullable=False)  # 1-400
    
    # Card data (5x5 grid with B-I-N-G-O columns)
    # B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
    # Center (N[2][2]) is always FREE (0)
    numbers = Column(ARRAY(Integer), nullable=False)  # 25 numbers, 0 for FREE space
    is_taken = Column(Boolean, default=False)
    taken_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    taken_at = Column(DateTime, nullable=True)
    
    # Relationships
    game = relationship("Game", back_populates="cards")
    taken_by_user = relationship("User")

class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    referred_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Status
    status = Column(String(20), default="pending")  # pending, completed, expired
    bonus_paid = Column(Boolean, default=False)
    bonus_amount = Column(Float, default=2.0)  # 2 ETB per referral
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    referrer = relationship("User", foreign_keys=[referrer_id])
    referred = relationship("User", foreign_keys=[referred_id])

class SystemConfig(Base):
    __tablename__ = "system_config"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Pydantic models for API responses
from pydantic import BaseModel
from typing import List, Optional

class UserResponse(BaseModel):
    id: str
    telegram_id: int
    first_name: str
    last_name: Optional[str]
    username: Optional[str]
    won_balance: float
    deposited_balance: float
    is_verified: bool
    god_mode: bool
    referral_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    currency: str
    status: str
    crypto_currency: Optional[str]
    description: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class GameResponse(BaseModel):
    id: str
    room_id: str
    stake_amount: float
    state: str
    current_number: Optional[int]
    called_numbers: List[int]
    total_pot: float
    max_players: int
    winner_id: Optional[str]
    winning_pattern: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class BingoCardResponse(BaseModel):
    id: str
    card_number: int
    numbers: List[int]
    is_taken: bool
    taken_by_user_id: Optional[str]
    
    class Config:
        from_attributes = True

class GameState(BaseModel):
    game: GameResponse
    players: List[GamePlayer]
    cards: List[BingoCardResponse]
    time_remaining: Optional[int]
    current_phase: str

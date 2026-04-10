import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update, delete, func, and_, or_
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime, timedelta

from models import Base, User, Transaction, Game, GamePlayer, BingoCard, Referral, SystemConfig
from config import settings

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.engine = None
        self.session_factory = None
        self.pool = None

    async def initialize(self):
        """Initialize database connection and create tables"""
        try:
            # Create SQLAlchemy engine
            database_url = f"postgresql+asyncpg://{settings.DATABASE_URL}"
            self.engine = create_async_engine(
                database_url,
                echo=settings.DEBUG,
                pool_pre_ping=True,
                pool_recycle=3600,
                pool_size=20,
                max_overflow=30
            )
            
            # Create session factory
            self.session_factory = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # Create tables
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            # Initialize system config
            await self._init_system_config()
            
            logger.info("Database initialized successfully")
            
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise

    async def close(self):
        """Close database connections"""
        if self.engine:
            await self.engine.dispose()
        if self.pool:
            await self.pool.close()
        logger.info("Database connections closed")

    @asynccontextmanager
    async def get_session(self):
        """Get database session"""
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                raise

    async def _init_system_config(self):
        """Initialize system configuration"""
        default_configs = {
            "welcome_bonus": "10",
            "referral_bonus": "2",
            "max_referrals": "20",
            "min_withdrawal": "100",
            "house_edge": "0.10",
            "game_lobby_duration": "30",
            "game_warning_duration": "5",
            "number_call_interval": "3",
            "system_bot_win_chance": "0.10"
        }
        
        async with self.get_session() as session:
            for key, value in default_configs.items():
                existing = await session.execute(
                    select(SystemConfig).where(SystemConfig.key == key)
                )
                if not existing.scalar_one_or_none():
                    config = SystemConfig(
                        key=key,
                        value=value,
                        description=f"Default configuration for {key}"
                    )
                    session.add(config)

    # User operations
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        async with self.get_session() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()

    async def get_user_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        """Get user by Telegram ID"""
        async with self.get_session() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            return result.scalar_one_or_none()

    async def get_user_by_phone(self, phone: str) -> Optional[User]:
        """Get user by phone number"""
        async with self.get_session() as session:
            result = await session.execute(
                select(User).where(User.phone == phone)
            )
            return result.scalar_one_or_none()

    async def create_user(self, telegram_id: int, first_name: str, last_name: str = "", username: str = "") -> User:
        """Create new user"""
        async with self.get_session() as session:
            user = User(
                telegram_id=telegram_id,
                first_name=first_name,
                last_name=last_name,
                username=username
            )
            session.add(user)
            await session.flush()
            await session.refresh(user)
            return user

    async def update_user(self, user_id: str, **kwargs) -> bool:
        """Update user"""
        async with self.get_session() as session:
            stmt = update(User).where(User.id == user_id).values(**kwargs)
            result = await session.execute(stmt)
            return result.rowcount > 0

    async def update_user_balance(self, user_id: str, won_balance: float = None, deposited_balance: float = None) -> bool:
        """Update user balance atomically"""
        async with self.get_session() as session:
            updates = {}
            if won_balance is not None:
                updates["won_balance"] = won_balance
            if deposited_balance is not None:
                updates["deposited_balance"] = deposited_balance
            
            if updates:
                updates["updated_at"] = datetime.utcnow()
                stmt = update(User).where(User.id == user_id).values(**updates)
                result = await session.execute(stmt)
                return result.rowcount > 0
            return False

    # Transaction operations
    async def create_transaction(self, user_id: str, type: str, amount: float, 
                               status: str = "pending", **kwargs) -> Transaction:
        """Create transaction"""
        async with self.get_session() as session:
            transaction = Transaction(
                user_id=user_id,
                type=type,
                amount=amount,
                status=status,
                **kwargs
            )
            session.add(transaction)
            await session.flush()
            await session.refresh(transaction)
            return transaction

    async def get_user_transactions(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Transaction]:
        """Get user transactions"""
        async with self.get_session() as session:
            result = await session.execute(
                select(Transaction)
                .where(Transaction.user_id == user_id)
                .order_by(Transaction.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return result.scalars().all()

    async def get_total_deposits(self, user_id: str) -> float:
        """Get total deposits for user"""
        async with self.get_session() as session:
            result = await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0))
                .where(
                    and_(
                        Transaction.user_id == user_id,
                        Transaction.type == "deposit",
                        Transaction.status == "completed"
                    )
                )
            )
            return float(result.scalar() or 0)

    # Game operations
    async def create_game(self, stake_amount: float, max_players: int = 200) -> Game:
        """Create new game"""
        async with self.get_session() as session:
            import uuid
            room_id = str(uuid.uuid4())[:8]
            
            game = Game(
                room_id=room_id,
                stake_amount=stake_amount,
                max_players=max_players,
                lobby_start=datetime.utcnow()
            )
            session.add(game)
            await session.flush()
            await session.refresh(game)
            
            # Generate bingo cards for this game
            await self._generate_bingo_cards(session, game.id)
            
            return game

    async def _generate_bingo_cards(self, session, game_id: str):
        """Generate 400 bingo cards for a game"""
        import random
        
        cards = []
        for card_num in range(1, 401):
            # Generate 5x5 bingo card numbers
            numbers = []
            
            # B column: 1-15
            b_col = random.sample(range(1, 16), 5)
            # I column: 16-30
            i_col = random.sample(range(16, 31), 5)
            # N column: 31-45 (center is FREE = 0)
            n_col = random.sample(range(31, 46), 2) + [0] + random.sample(range(31, 46), 2)
            # G column: 46-60
            g_col = random.sample(range(46, 61), 5)
            # O column: 61-75
            o_col = random.sample(range(61, 76), 5)
            
            # Combine columns
            numbers = b_col + i_col + n_col + g_col + o_col
            
            card = BingoCard(
                game_id=game_id,
                card_number=card_num,
                numbers=numbers
            )
            cards.append(card)
        
        session.add_all(cards)

    async def get_game_by_room_id(self, room_id: str) -> Optional[Game]:
        """Get game by room ID"""
        async with self.get_session() as session:
            result = await session.execute(
                select(Game).where(Game.room_id == room_id)
            )
            return result.scalar_one_or_none()

    async def get_available_cards(self, game_id: str) -> List[BingoCard]:
        """Get available bingo cards for a game"""
        async with self.get_session() as session:
            result = await session.execute(
                select(BingoCard)
                .where(and_(BingoCard.game_id == game_id, BingoCard.is_taken == False))
                .order_by(BingoCard.card_number)
            )
            return result.scalars().all()

    async def take_bingo_cards(self, game_id: str, user_id: str, card_numbers: List[int]) -> bool:
        """Take bingo cards for a user"""
        async with self.get_session() as session:
            # Check if cards are available
            result = await session.execute(
                select(BingoCard)
                .where(
                    and_(
                        BingoCard.game_id == game_id,
                        BingoCard.card_number.in_(card_numbers),
                        BingoCard.is_taken == False
                    )
                )
            )
            cards = result.scalars().all()
            
            if len(cards) != len(card_numbers):
                return False  # Some cards not available
            
            # Take the cards
            for card in cards:
                card.is_taken = True
                card.taken_by_user_id = user_id
                card.taken_at = datetime.utcnow()
            
            return True

    async def get_user_cards(self, game_id: str, user_id: str) -> List[BingoCard]:
        """Get user's bingo cards for a game"""
        async with self.get_session() as session:
            result = await session.execute(
                select(BingoCard)
                .where(
                    and_(
                        BingoCard.game_id == game_id,
                        BingoCard.taken_by_user_id == user_id
                    )
                )
            )
            return result.scalars().all()

    async def add_game_player(self, game_id: str, user_id: str, card_numbers: List[int]) -> GamePlayer:
        """Add player to game"""
        async with self.get_session() as session:
            player = GamePlayer(
                game_id=game_id,
                user_id=user_id,
                cards_selected=card_numbers
            )
            session.add(player)
            await session.flush()
            await session.refresh(player)
            return player

    async def get_game_players(self, game_id: str) -> List[GamePlayer]:
        """Get all players in a game"""
        async with self.get_session() as session:
            result = await session.execute(
                select(GamePlayer)
                .where(GamePlayer.game_id == game_id)
                .options(selectinload(GamePlayer.user))
            )
            return result.scalars().all()

    # Referral operations
    async def create_referral(self, referrer_id: str, referred_id: str) -> Referral:
        """Create referral"""
        async with self.get_session() as session:
            referral = Referral(
                referrer_id=referrer_id,
                referred_id=referred_id,
                expires_at=datetime.utcnow() + timedelta(days=30)
            )
            session.add(referral)
            await session.flush()
            await session.refresh(referral)
            return referral

    async def get_referrals_by_referrer(self, referrer_id: str) -> List[Referral]:
        """Get referrals by referrer"""
        async with self.get_session() as session:
            result = await session.execute(
                select(Referral)
                .where(Referral.referrer_id == referrer_id)
                .options(selectinload(Referral.referred))
            )
            return result.scalars().all()

    async def complete_referral(self, referral_id: str) -> bool:
        """Complete referral and pay bonus"""
        async with self.get_session() as session:
            # Get referral
            result = await session.execute(
                select(Referral).where(Referral.id == referral_id)
            )
            referral = result.scalar_one_or_none()
            
            if not referral or referral.status != "pending":
                return False
            
            # Update referral
            referral.status = "completed"
            referral.completed_at = datetime.utcnow()
            
            # Pay bonus to referrer
            await self.update_user_balance(
                referral.referrer_id, 
                deposited_balance=referral.bonus_amount
            )
            
            # Create bonus transaction
            await self.create_transaction(
                user_id=referral.referrer_id,
                type="referral_bonus",
                amount=referral.bonus_amount,
                status="completed",
                description=f"Referral bonus for {referral.referred.first_name}"
            )
            
            # Update referrer count
            await session.execute(
                update(User)
                .where(User.id == referral.referrer_id)
                .values(referral_count=User.referral_count + 1)
            )
            
            return True

    # System config operations
    async def get_config(self, key: str) -> Optional[str]:
        """Get system configuration value"""
        async with self.get_session() as session:
            result = await session.execute(
                select(SystemConfig.value).where(SystemConfig.key == key)
            )
            return result.scalar_one_or_none()

    async def set_config(self, key: str, value: str, description: str = None) -> bool:
        """Set system configuration value"""
        async with self.get_session() as session:
            # Check if config exists
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.key == key)
            )
            config = result.scalar_one_or_none()
            
            if config:
                config.value = value
                config.updated_at = datetime.utcnow()
                if description:
                    config.description = description
            else:
                config = SystemConfig(key=key, value=value, description=description)
                session.add(config)
            
            return True

# Dependency for FastAPI
async def get_db() -> Database:
    return Database()

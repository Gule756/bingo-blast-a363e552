import asyncio
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from enum import Enum
import json
import uuid

from database import Database
from models import Game, GamePlayer, BingoCard, User, GameState
from config import settings

logger = logging.getLogger(__name__)

class GamePhase(Enum):
    LOBBY = "lobby"
    WARNING = "warning"
    ACTIVE = "active"
    FINISHED = "finished"

class BingoPattern(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"
    DIAGONAL = "diagonal"
    CORNERS = "corners"
    FULL_HOUSE = "full_house"

class GameRoom:
    def __init__(self, game: Game, db: Database):
        self.game = game
        self.db = db
        self.players: Dict[str, GamePlayer] = {}  # user_id -> GamePlayer
        self.cards: Dict[int, BingoCard] = {}  # card_number -> BingoCard
        self.called_numbers: Set[int] = set()
        self.phase = GamePhase.LOBBY
        self.time_remaining = 30  # seconds
        self.task: Optional[asyncio.Task] = None
        self.lock = asyncio.Lock()
        
    async def initialize(self):
        """Initialize game room"""
        # Load existing players and cards
        self.players = {
            player.user_id: player 
            for player in await self.db.get_game_players(self.game.id)
        }
        
        # Load all cards
        all_cards = await self.db.get_available_cards(self.game.id)
        self.cards = {card.card_number: card for card in all_cards}
        
        # Load called numbers
        self.called_numbers = set(self.game.called_numbers or [])
        
        # Determine current phase
        if self.game.state == "lobby":
            self.phase = GamePhase.LOBBY
            self.time_remaining = max(0, 30 - int((datetime.utcnow() - self.game.lobby_start).total_seconds()))
        elif self.game.state == "warning":
            self.phase = GamePhase.WARNING
            self.time_remaining = max(0, 5 - int((datetime.utcnow() - self.game.lobby_end).total_seconds()))
        elif self.game.state == "active":
            self.phase = GamePhase.ACTIVE
            self.called_numbers = set(self.game.called_numbers or [])
        else:
            self.phase = GamePhase.FINISHED

    async def add_player(self, user_id: str, card_numbers: List[int]) -> bool:
        """Add player to game"""
        async with self.lock:
            if self.phase != GamePhase.LOBBY:
                return False
            
            if user_id in self.players:
                return False
            
            # Check if cards are available
            available_cards = [num for num in card_numbers if num in self.cards and not self.cards[num].is_taken]
            if len(available_cards) != len(card_numbers):
                return False
            
            # Take cards
            if not await self.db.take_bingo_cards(self.game.id, user_id, card_numbers):
                return False
            
            # Add player
            player = await self.db.add_game_player(self.game.id, user_id, card_numbers)
            self.players[user_id] = player
            
            # Update cards
            for card_num in card_numbers:
                if card_num in self.cards:
                    self.cards[card_num].is_taken = True
                    self.cards[card_num].taken_by_user_id = user_id
            
            # Update pot
            self.game.total_pot += self.game.stake_amount * len(card_numbers)
            
            return True

    async def get_game_state(self) -> Dict:
        """Get current game state"""
        return {
            "game_id": str(self.game.id),
            "room_id": self.game.room_id,
            "phase": self.phase.value,
            "time_remaining": self.time_remaining,
            "current_number": self.game.current_number,
            "called_numbers": list(self.called_numbers),
            "total_pot": self.game.total_pot,
            "stake_amount": self.game.stake_amount,
            "player_count": len(self.players),
            "winner_id": str(self.game.winner_id) if self.game.winner_id else None,
            "winning_pattern": self.game.winning_pattern
        }

    async def get_player_cards(self, user_id: str) -> List[Dict]:
        """Get player's cards with marked numbers"""
        if user_id not in self.players:
            return []
        
        player_cards = await self.db.get_user_cards(self.game.id, user_id)
        cards_data = []
        
        for card in player_cards:
            card_data = {
                "card_number": card.card_number,
                "numbers": card.numbers,
                "marked": [num in self.called_numbers for num in card.numbers]
            }
            cards_data.append(card_data)
        
        return cards_data

    async def claim_bingo(self, user_id: str) -> Dict:
        """Process bingo claim"""
        async with self.lock:
            if self.phase != GamePhase.ACTIVE:
                return {"success": False, "reason": "Game not in active phase"}
            
            if user_id not in self.players:
                return {"success": False, "reason": "Player not in game"}
            
            # Get player's cards
            player_cards = await self.db.get_user_cards(self.game.id, user_id)
            
            # Check each card for winning pattern
            for card in player_cards:
                winning_pattern = self._check_bingo(card.numbers, self.called_numbers)
                if winning_pattern:
                    # Valid bingo!
                    await self._end_game(user_id, winning_pattern, [card.card_number])
                    return {
                        "success": True,
                        "winner_id": user_id,
                        "winning_pattern": winning_pattern,
                        "winning_cards": [card.card_number],
                        "pot": self.game.total_pot
                    }
            
            # False bingo - penalize player
            return {"success": False, "reason": "Invalid bingo claim"}

    def _check_bingo(self, card_numbers: List[int], called_numbers: Set[int]) -> Optional[str]:
        """Check if card has winning pattern"""
        # Convert to 5x5 grid
        grid = []
        for i in range(5):
            row = card_numbers[i*5:(i+1)*5]
            grid.append(row)
        
        # Check horizontal lines
        for i in range(5):
            if all(num == 0 or num in called_numbers for num in grid[i]):
                return BingoPattern.HORIZONTAL.value
        
        # Check vertical lines
        for j in range(5):
            if all(grid[i][j] == 0 or grid[i][j] in called_numbers for i in range(5)):
                return BingoPattern.VERTICAL.value
        
        # Check diagonal
        diag1 = [grid[i][i] for i in range(5)]
        diag2 = [grid[i][4-i] for i in range(5)]
        
        if all(num == 0 or num in called_numbers for num in diag1):
            return BingoPattern.DIAGONAL.value
        
        if all(num == 0 or num in called_numbers for num in diag2):
            return BingoPattern.DIAGONAL.value
        
        # Check corners
        corners = [grid[0][0], grid[0][4], grid[4][0], grid[4][4]]
        if all(num == 0 or num in called_numbers for num in corners):
            return BingoPattern.CORNERS.value
        
        # Check full house
        if all(num == 0 or num in called_numbers for row in grid for num in row):
            return BingoPattern.FULL_HOUSE.value
        
        return None

    async def _end_game(self, winner_id: str, pattern: str, winning_cards: List[int]):
        """End the game"""
        self.phase = GamePhase.FINISHED
        self.game.winner_id = winner_id
        self.game.winning_pattern = pattern
        self.game.winning_cards = winning_cards
        self.game.game_end = datetime.utcnow()
        
        # Calculate winnings
        house_cut = self.game.total_pot * self.game.house_edge
        winnings = self.game.total_pot - house_cut
        self.game.house_cut = house_cut
        
        # Update winner's balance (won_balance is withdrawable)
        await self.db.update_user_balance(winner_id, won_balance=winnings)
        
        # Create transaction
        await self.db.create_transaction(
            user_id=winner_id,
            type="win",
            amount=winnings,
            status="completed",
            description=f"Bingo win in room {self.game.room_id}"
        )
        
        # Update game state
        self.game.state = "finished"
        await self.db.update_game(self.game.id, state="finished")

class GameEngine:
    def __init__(self, db: Database):
        self.db = db
        self.rooms: Dict[str, GameRoom] = {}  # room_id -> GameRoom
        self.running = False
        self.main_task: Optional[asyncio.Task] = None
        self.number_call_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start game engine"""
        self.running = True
        
        # Load existing games
        await self._load_existing_games()
        
        # Start main loop
        self.main_task = asyncio.create_task(self._main_loop())
        
        # Start number calling loop
        self.number_call_task = asyncio.create_task(self._number_call_loop())
        
        logger.info("Game engine started")

    async def stop(self):
        """Stop game engine"""
        self.running = False
        
        if self.main_task:
            self.main_task.cancel()
        
        if self.number_call_task:
            self.number_call_task.cancel()
        
        # Cancel all room tasks
        for room in self.rooms.values():
            if room.task:
                room.task.cancel()
        
        logger.info("Game engine stopped")

    async def _load_existing_games(self):
        """Load existing active games"""
        # This would load games that were interrupted during server restart
        pass

    async def _main_loop(self):
        """Main game loop"""
        while self.running:
            try:
                await self._update_games()
                await asyncio.sleep(1)  # Update every second
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Main loop error: {e}")

    async def _update_games(self):
        """Update all game rooms"""
        for room_id, room in list(self.rooms.items()):
            try:
                await self._update_room(room)
            except Exception as e:
                logger.error(f"Error updating room {room_id}: {e}")

    async def _update_room(self, room: GameRoom):
        """Update individual room"""
        async with room.lock:
            if room.phase == GamePhase.LOBBY:
                room.time_remaining = max(0, room.time_remaining - 1)
                
                if room.time_remaining == 0:
                    # Move to warning phase
                    room.phase = GamePhase.WARNING
                    room.time_remaining = 5
                    room.game.lobby_end = datetime.utcnow()
                    room.game.state = "warning"
                    
            elif room.phase == GamePhase.WARNING:
                room.time_remaining = max(0, room.time_remaining - 1)
                
                if room.time_remaining == 0:
                    # Start game
                    await self._start_game(room)
                    
            elif room.phase == GamePhase.ACTIVE:
                # Game is running, numbers are called by separate loop
                pass

    async def _start_game(self, room: GameRoom):
        """Start the game"""
        room.phase = GamePhase.ACTIVE
        room.game.game_start = datetime.utcnow()
        room.game.state = "active"
        room.called_numbers = set()
        room.game.called_numbers = []
        room.game.current_number = None
        
        logger.info(f"Game {room.game.room_id} started with {len(room.players)} players")

    async def _number_call_loop(self):
        """Number calling loop for all active games"""
        while self.running:
            try:
                # Get all active rooms
                active_rooms = [room for room in self.rooms.values() if room.phase == GamePhase.ACTIVE]
                
                for room in active_rooms:
                    await self._call_number(room)
                
                await asyncio.sleep(3)  # Call numbers every 3 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Number call loop error: {e}")

    async def _call_number(self, room: GameRoom):
        """Call a random number for a room"""
        async with room.lock:
            if room.phase != GamePhase.ACTIVE:
                return
            
            # Get remaining numbers
            remaining_numbers = set(range(1, 76)) - room.called_numbers
            
            if not remaining_numbers:
                # All numbers called - end game
                await self._end_game_no_winner(room)
                return
            
            # Call random number
            number = random.choice(list(remaining_numbers))
            room.called_numbers.add(number)
            room.game.called_numbers = list(room.called_numbers)
            room.game.current_number = number
            
            # Check for system bot win (10% chance after 30 numbers)
            if len(room.called_numbers) >= 30 and random.random() < 0.10:
                await self._system_bot_win(room)

    async def _system_bot_win(self, room: GameRoom):
        """System bot wins the game"""
        room.game.is_system_winner = True
        room.game.winner_id = None
        room.game.winning_pattern = "system_bot"
        room.game.game_end = datetime.utcnow()
        room.game.state = "finished"
        room.phase = GamePhase.FINISHED
        
        logger.info(f"System bot won game {room.game.room_id}")

    async def _end_game_no_winner(self, room: GameRoom):
        """End game with no winner"""
        room.game.game_end = datetime.utcnow()
        room.game.state = "finished"
        room.phase = GamePhase.FINISHED
        
        logger.info(f"Game {room.game.room_id} ended with no winner")

    async def create_game(self, stake_amount: float) -> GameRoom:
        """Create new game room"""
        game = await self.db.create_game(stake_amount)
        room = GameRoom(game, self.db)
        await room.initialize()
        
        self.rooms[game.room_id] = room
        
        # Start room task
        room.task = asyncio.create_task(self._room_loop(room))
        
        logger.info(f"Created game room {game.room_id} with stake {stake_amount}")
        return room

    async def _room_loop(self, room: GameRoom):
        """Individual room loop"""
        try:
            while room.phase != GamePhase.FINISHED and self.running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        finally:
            # Clean up room
            if room.game.room_id in self.rooms:
                del self.rooms[room.game.room_id]

    async def get_room(self, room_id: str) -> Optional[GameRoom]:
        """Get game room"""
        return self.rooms.get(room_id)

    async def select_cards(self, user_id: str, room_id: str, card_numbers: List[int]) -> Dict:
        """Select cards for user"""
        room = await self.get_room(room_id)
        if not room:
            return {"success": False, "reason": "Room not found"}
        
        success = await room.add_player(user_id, card_numbers)
        
        if success:
            return {
                "success": True,
                "cards": await room.get_player_cards(user_id),
                "game_state": await room.get_game_state()
            }
        else:
            return {"success": False, "reason": "Failed to select cards"}

    async def claim_bingo(self, user_id: str, room_id: str) -> Dict:
        """Claim bingo"""
        room = await self.get_room(room_id)
        if not room:
            return {"success": False, "reason": "Room not found"}
        
        return await room.claim_bingo(user_id)

    async def get_game_state(self, room_id: str) -> Optional[Dict]:
        """Get game state"""
        room = await self.get_room(room_id)
        if not room:
            return None
        
        return await room.get_game_state()

    def is_running(self) -> bool:
        """Check if engine is running"""
        return self.running

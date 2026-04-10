#!/usr/bin/env python3
"""
Simple Game Loop for Habesha Bingo
Basic game mechanics with database integration
"""

import asyncio
import random
import logging
from datetime import datetime, timedelta
import sqlite3
from contextlib import contextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BingoGame:
    def __init__(self):
        self.games = {}  # room_id -> game_state
        self.running = False
        
    @contextmanager
    def get_db_cursor(self):
        """Get database cursor"""
        conn = sqlite3.connect('habesha_bingo.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def create_game(self, stake_amount: float, max_players: int = 200):
        """Create a new game room"""
        import uuid
        room_id = str(uuid.uuid4())[:8]
        
        game_state = {
            'room_id': room_id,
            'stake_amount': stake_amount,
            'max_players': max_players,
            'players': {},  # user_id -> player_data
            'phase': 'lobby',  # lobby, warning, active, finished
            'time_remaining': 30,  # seconds
            'called_numbers': [],
            'current_number': None,
            'total_pot': 0.0,
            'game_start': None,
            'winner_id': None,
            'winning_pattern': None,
            'created_at': datetime.utcnow()
        }
        
        self.games[room_id] = game_state
        
        # Save to database
        with self.get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO games (room_id, stake_amount, max_players, state, created_at)
                VALUES (?, ?, ?, 'lobby', ?)
            """, (room_id, stake_amount, max_players, datetime.utcnow()))
        
        logger.info(f"Created game room {room_id} with stake {stake_amount}")
        return room_id
    
    def join_game(self, room_id: str, user_id: int, card_ids: list):
        """Join a game room"""
        if room_id not in self.games:
            return False, "Game not found"
        
        game = self.games[room_id]
        
        if game['phase'] != 'lobby':
            return False, "Game not in lobby phase"
        
        if user_id in game['players']:
            return False, "Already in game"
        
        if len(game['players']) >= game['max_players']:
            return False, "Game is full"
        
        # Add player
        game['players'][user_id] = {
            'user_id': user_id,
            'card_ids': card_ids,
            'joined_at': datetime.utcnow(),
            'is_active': True
        }
        
        # Update pot
        game['total_pot'] += game['stake_amount'] * len(card_ids)
        
        logger.info(f"User {user_id} joined game {room_id} with {len(card_ids)} cards")
        return True, "Joined successfully"
    
    async def start_game_loop(self):
        """Main game loop"""
        self.running = True
        
        while self.running:
            try:
                await self.update_all_games()
                await asyncio.sleep(1)  # Update every second
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Game loop error: {e}")
        
        logger.info("Game loop stopped")
    
    async def update_all_games(self):
        """Update all active games"""
        for room_id, game in list(self.games.items()):
            try:
                await self.update_game(game)
            except Exception as e:
                logger.error(f"Error updating game {room_id}: {e}")
    
    async def update_game(self, game):
        """Update individual game"""
        if game['phase'] == 'lobby':
            game['time_remaining'] = max(0, game['time_remaining'] - 1)
            
            if game['time_remaining'] == 0:
                # Move to warning phase
                game['phase'] = 'warning'
                game['time_remaining'] = 5
                logger.info(f"Game {game['room_id']} entered warning phase")
                
        elif game['phase'] == 'warning':
            game['time_remaining'] = max(0, game['time_remaining'] - 1)
            
            if game['time_remaining'] == 0:
                # Start game
                await self.start_active_game(game)
                
        elif game['phase'] == 'active':
            # Game is running - numbers called by separate loop
            pass
    
    async def start_active_game(self, game):
        """Start the active game phase"""
        game['phase'] = 'active'
        game['time_remaining'] = 0
        game['called_numbers'] = []
        game['game_start'] = datetime.utcnow()
        
        # Generate bingo cards for all players
        await self.generate_bingo_cards(game)
        
        logger.info(f"Game {game['room_id']} started with {len(game['players'])} players")
    
    async def generate_bingo_cards(self, game):
        """Generate bingo cards for all players"""
        for user_id, player in game['players'].items():
            cards = []
            for card_id in player['card_ids']:
                # Generate 5x5 bingo card
                card_numbers = self.generate_card_numbers()
                cards.append({
                    'card_id': card_id,
                    'numbers': card_numbers,
                    'marked': [False] * 25  # 25 cells, center is free
                })
            
            player['cards'] = cards
    
    def generate_card_numbers(self):
        """Generate numbers for a bingo card"""
        # B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
        card = []
        
        # B column
        card.extend(random.sample(range(1, 16), 5))
        # I column
        card.extend(random.sample(range(16, 31), 5))
        # N column (center is free)
        n_numbers = random.sample(range(31, 46), 2)
        card.extend([n_numbers[0], n_numbers[1], 0, n_numbers[2], n_numbers[3]])
        # G column
        card.extend(random.sample(range(46, 61), 5))
        # O column
        card.extend(random.sample(range(61, 76), 5))
        
        return card
    
    async def call_number(self, game):
        """Call a random number for the game"""
        if game['phase'] != 'active':
            return None
        
        remaining_numbers = set(range(1, 76)) - set(game['called_numbers'])
        
        if not remaining_numbers:
            return None
        
        number = random.choice(list(remaining_numbers))
        game['called_numbers'].append(number)
        game['current_number'] = number
        
        # Mark cards for all players
        await self.mark_all_cards(game, number)
        
        # Check for winners
        winners = await self.check_winners(game)
        
        if winners:
            # End game with winner
            await self.end_game(game, winners[0])
        
        return number
    
    async def mark_all_cards(self, game, number):
        """Mark number on all player cards"""
        for user_id, player in game['players'].items():
            for card in player['cards']:
                for i, num in enumerate(card['numbers']):
                    if num == number and i != 12:  # Don't mark center (index 12)
                        card['marked'][i] = True
    
    async def check_winners(self, game):
        """Check for winning patterns"""
        winners = []
        
        for user_id, player in game['players'].items():
            for card in player['cards']:
                if self.check_bingo(card['numbers'], card['marked']):
                    winners.append({
                        'user_id': user_id,
                        'card_id': card['card_id'],
                        'pattern': self.get_winning_pattern(card['numbers'], card['marked'])
                    })
                    break  # One win per player
        
        return winners
    
    def check_bingo(self, numbers, marked):
        """Check if card has winning pattern"""
        # Convert to 5x5 grid
        grid = []
        for i in range(5):
            row = numbers[i*5:(i+1)*5]
            grid.append(row)
        
        marked_grid = []
        for i in range(5):
            row = marked[i*5:(i+1)*5]
            marked_grid.append(row)
        
        # Check horizontal lines
        for i in range(5):
            if all(marked_grid[i][j] or grid[i][j] == 0 for j in range(5)):
                return True
        
        # Check vertical lines
        for j in range(5):
            if all(marked_grid[i][j] or grid[i][j] == 0 for i in range(5)):
                return True
        
        # Check diagonal
        diag1 = [marked_grid[i][i] or grid[i][i] == 0 for i in range(5)]
        diag2 = [marked_grid[i][4-i] or grid[i][4-i] == 0 for i in range(5)]
        
        if all(diag1) or all(diag2):
            return True
        
        # Check corners
        corners = [
            marked_grid[0][0] or grid[0][0] == 0,
            marked_grid[0][4] or grid[0][4] == 0,
            marked_grid[4][0] or grid[4][0] == 0,
            marked_grid[4][4] or grid[4][4] == 0
        ]
        
        if all(corners):
            return True
        
        # Check full house
        all_marked = True
        for i in range(5):
            for j in range(5):
                if not (marked_grid[i][j] or grid[i][j] == 0):
                    all_marked = False
                    break
        
        return all_marked
    
    def get_winning_pattern(self, numbers, marked):
        """Get the winning pattern"""
        # Simplified - return first pattern found
        return "bingo"
    
    async def end_game(self, game, winner):
        """End the game with a winner"""
        game['phase'] = 'finished'
        game['winner_id'] = winner['user_id']
        game['winning_pattern'] = winner['pattern']
        
        # Calculate winnings (90% to winner, 10% house)
        winnings = game['total_pot'] * 0.9
        house_cut = game['total_pot'] * 0.1
        
        # Update winner's balance
        with self.get_db_cursor() as cursor:
            cursor.execute("""
                UPDATE users 
                SET won_balance = won_balance + ? 
                WHERE telegram_id = ?
            """, (winnings, winner['user_id']))
            
            # Create transaction
            cursor.execute("""
                INSERT INTO transactions (user_id, type, amount, status, description)
                VALUES (?, 'win', ?, 'completed', ?)
            """, (winner['user_id'], winnings, f"Bingo win in room {game['room_id']}"))
        
        logger.info(f"Game {game['room_id']} ended! Winner: {winner['user_id']}, Prize: {winnings} ETB")
    
    async def number_calling_loop(self):
        """Separate loop for calling numbers"""
        while self.running:
            try:
                for game in self.games.values():
                    if game['phase'] == 'active':
                        await self.call_number(game)
                
                await asyncio.sleep(3)  # Call numbers every 3 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Number calling error: {e}")
    
    def get_game_state(self, room_id):
        """Get current game state"""
        return self.games.get(room_id)
    
    def get_active_games(self):
        """Get all active games"""
        return {
            room_id: game for room_id, game in self.games.items()
            if game['phase'] in ['lobby', 'warning', 'active']
        }
    
    async def stop(self):
        """Stop the game loop"""
        self.running = False

# Global game instance
game_instance = BingoGame()

# Example usage
async def main():
    """Test the game loop"""
    # Create a test game
    room_id = game_instance.create_game(10.0)  # 10 ETB stake
    
    # Add some test players
    game_instance.join_game(room_id, 123456, [1, 2, 3])
    game_instance.join_game(room_id, 789012, [4, 5])
    
    # Start game loops
    game_task = asyncio.create_task(game_instance.start_game_loop())
    number_task = asyncio.create_task(game_instance.number_calling_loop())
    
    # Run for testing
    await asyncio.sleep(60)  # Run for 1 minute
    
    # Stop
    await game_instance.stop()

if __name__ == "__main__":
    asyncio.run(main())

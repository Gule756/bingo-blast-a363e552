import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { apiClient, User, GameState, PlayerCard } from '@/lib/api-client';

// Types
interface GamePlayer {
  user_id: string;
  cards_selected: number[];
  is_active: boolean;
}

interface GameRoom {
  room_id: string;
  stake_amount: number;
  player_count: number;
  time_remaining: number;
  phase: string;
  current_number?: number;
  called_numbers: number[];
  total_pot: number;
}

// State interface
interface GameStateType {
  // User
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Game
  currentRoom: GameRoom | null;
  playerCards: PlayerCard[];
  selectedCards: number[];
  isGameActive: boolean;
  
  // UI State
  phase: 'welcome' | 'stakeSelect' | 'lobby' | 'game' | 'profile' | 'deposit' | 'withdraw';
}

// Action types
type GameAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_PHASE'; payload: GameStateType['phase'] }
  | { type: 'SET_CURRENT_ROOM'; payload: GameRoom | null }
  | { type: 'SET_PLAYER_CARDS'; payload: PlayerCard[] }
  | { type: 'SET_SELECTED_CARDS'; payload: number[] }
  | { type: 'SET_GAME_ACTIVE'; payload: boolean }
  | { type: 'UPDATE_GAME_STATE'; payload: Partial<GameRoom> }
  | { type: 'RESET_GAME' };

// Initial state
const initialState: GameStateType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  currentRoom: null,
  playerCards: [],
  selectedCards: [],
  isGameActive: false,
  phase: 'welcome'
};

// Reducer
function gameReducer(state: GameStateType, action: GameAction): GameStateType {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    
    case 'SET_CURRENT_ROOM':
      return { ...state, currentRoom: action.payload };
    
    case 'SET_PLAYER_CARDS':
      return { ...state, playerCards: action.payload };
    
    case 'SET_SELECTED_CARDS':
      return { ...state, selectedCards: action.payload };
    
    case 'SET_GAME_ACTIVE':
      return { ...state, isGameActive: action.payload };
    
    case 'UPDATE_GAME_STATE':
      return {
        ...state,
        currentRoom: state.currentRoom ? { ...state.currentRoom, ...action.payload } : null
      };
    
    case 'RESET_GAME':
      return {
        ...state,
        currentRoom: null,
        playerCards: [],
        selectedCards: [],
        isGameActive: false
      };
    
    default:
      return state;
  }
}

// Context
const GameContext2 = createContext<{
  state: GameStateType;
  dispatch: React.Dispatch<GameAction>;
  actions: {
    // Authentication
    authenticate: () => Promise<void>;
    verifyContact: (phone: string) => Promise<void>;
    
    // Navigation
    setPhase: (phase: GameStateType['phase']) => void;
    
    // Game actions
    joinRoom: (roomId: string) => void;
    selectCards: (cardIds: number[]) => void;
    claimBingo: () => void;
    
    // Financial
    getBalance: () => Promise<any>;
    generateDepositAddress: (currency: 'USDT' | 'TON') => Promise<any>;
    requestWithdrawal: (amount: number, currency: 'USDT' | 'TON', wallet: string) => Promise<any>;
    
    // Utility
    logout: () => void;
    clearError: () => void;
  };
} | null>(null);

// Provider
export function GameProvider2({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Authentication
  const authenticate = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const user = await apiClient.authenticate();
      
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      dispatch({ type: 'SET_LOADING', payload: false });
      
      // Connect WebSocket
      await apiClient.connectWebSocket();
      
      // Set initial phase based on verification status
      if (user.is_verified) {
        dispatch({ type: 'SET_PHASE', payload: 'stakeSelect' });
      } else {
        dispatch({ type: 'SET_PHASE', payload: 'welcome' });
      }
      
    } catch (error) {
      console.error('Authentication error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to authenticate' });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const verifyContact = useCallback(async (phone: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      await apiClient.verifyContact(phone);
      
      // Refresh user data
      await authenticate();
      
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('Contact verification error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Verification failed' });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [authenticate]);

  // Navigation
  const setPhase = useCallback((phase: GameStateType['phase']) => {
    dispatch({ type: 'SET_PHASE', payload: phase });
  }, []);

  // Game actions
  const joinRoom = useCallback((roomId: string) => {
    apiClient.joinGame(roomId);
  }, []);

  const selectCards = useCallback((cardIds: number[]) => {
    if (state.currentRoom) {
      apiClient.selectCards(state.currentRoom.room_id, cardIds);
      dispatch({ type: 'SET_SELECTED_CARDS', payload: cardIds });
    }
  }, [state.currentRoom]);

  const claimBingo = useCallback(() => {
    if (state.currentRoom) {
      apiClient.claimBingo(state.currentRoom.room_id);
    }
  }, [state.currentRoom]);

  // Financial actions
  const getBalance = useCallback(async () => {
    try {
      return await apiClient.getBalance();
    } catch (error) {
      console.error('Balance fetch error:', error);
      throw error;
    }
  }, []);

  const generateDepositAddress = useCallback(async (currency: 'USDT' | 'TON') => {
    try {
      return await apiClient.generateDepositAddress(currency);
    } catch (error) {
      console.error('Deposit address generation error:', error);
      throw error;
    }
  }, []);

  const requestWithdrawal = useCallback(async (
    amount: number, 
    currency: 'USDT' | 'TON', 
    wallet: string
  ) => {
    try {
      return await apiClient.requestWithdrawal(amount, currency, wallet);
    } catch (error) {
      console.error('Withdrawal request error:', error);
      throw error;
    }
  }, []);

  // Utility
  const logout = useCallback(() => {
    apiClient.disconnectWebSocket();
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_AUTHENTICATED', payload: false });
    dispatch({ type: 'RESET_GAME' });
    dispatch({ type: 'SET_PHASE', payload: 'welcome' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // WebSocket message handlers
  useEffect(() => {
    // Game state updates
    apiClient.onWebSocketMessage('game_state', (data: GameState) => {
      dispatch({ type: 'SET_CURRENT_ROOM', payload: data });
      
      // Update phase based on game state
      if (data.phase === 'lobby') {
        dispatch({ type: 'SET_PHASE', payload: 'lobby' });
      } else if (data.phase === 'active') {
        dispatch({ type: 'SET_PHASE', payload: 'game' });
        dispatch({ type: 'SET_GAME_ACTIVE', payload: true });
      } else if (data.phase === 'finished') {
        dispatch({ type: 'SET_GAME_ACTIVE', payload: false });
      }
    });

    // Card selection response
    apiClient.onWebSocketMessage('cards_selected', (data) => {
      if (data.success) {
        dispatch({ type: 'SET_PLAYER_CARDS', payload: data.cards });
      }
    });

    // Bingo claim response
    apiClient.onWebSocketMessage('bingo_claim', (data) => {
      if (data.success) {
        // Handle win
        dispatch({ type: 'SET_GAME_ACTIVE', payload: false });
        // Could show win modal here
      }
    });

    return () => {
      apiClient.offWebSocketMessage('game_state');
      apiClient.offWebSocketMessage('cards_selected');
      apiClient.offWebSocketMessage('bingo_claim');
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      apiClient.disconnectWebSocket();
    };
  }, []);

  const actions = {
    authenticate,
    verifyContact,
    setPhase,
    joinRoom,
    selectCards,
    claimBingo,
    getBalance,
    generateDepositAddress,
    requestWithdrawal,
    logout,
    clearError
  };

  return (
    <GameContext2.Provider value={{ state, dispatch, actions }}>
      {children}
    </GameContext2.Provider>
  );
}

// Hook
export function useGame2() {
  const context = useContext(GameContext2);
  if (!context) {
    throw new Error('useGame2 must be used within GameProvider2');
  }
  return context;
}

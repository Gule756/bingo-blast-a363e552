// API Client for Habesha Bingo 2.0 Backend
import { getTelegramInitData, getTelegramUser } from './telegram';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  won_balance: number;
  deposited_balance: number;
  is_verified: boolean;
  god_mode: boolean;
  referral_count: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  crypto_currency?: string;
  description?: string;
  created_at: string;
  completed_at?: string;
}

export interface GameState {
  game_id: string;
  room_id: string;
  phase: string;
  time_remaining: number;
  current_number?: number;
  called_numbers: number[];
  total_pot: number;
  stake_amount: number;
  player_count: number;
  winner_id?: string;
  winning_pattern?: string;
}

export interface BingoCard {
  id: string;
  card_number: number;
  numbers: number[];
  is_taken: boolean;
  taken_by_user_id?: string;
}

export interface PlayerCard {
  card_number: number;
  numbers: number[];
  marked: boolean[];
}

class ApiClient {
  private user: User | null = null;
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, (data: any) => void> = new Map();

  async authenticate(): Promise<User> {
    try {
      const initData = getTelegramInitData();
      const tgUser = getTelegramUser();

      if (!initData || !tgUser) {
        throw new Error('Telegram data not available');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          init_data: initData,
          user: tgUser
        }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      this.user = data.user;
      return this.user;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  async verifyContact(phoneNumber: string): Promise<boolean> {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/verify-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: this.user.telegram_id,
          phone_number: phoneNumber
        }),
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const data = await response.json();
      
      // Refresh user data after verification
      await this.authenticate();
      
      return data.success;
    } catch (error) {
      console.error('Contact verification error:', error);
      throw error;
    }
  }

  async getBalance(): Promise<{ 
    won_balance: number; 
    deposited_balance: number; 
    total_balance: number;
    transactions: Transaction[];
  }> {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/user/${this.user.id}/balance`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      return await response.json();
    } catch (error) {
      console.error('Balance fetch error:', error);
      throw error;
    }
  }

  async generateDepositAddress(currency: 'USDT' | 'TON'): Promise<{
    address: string;
    currency: string;
    instructions: string;
  }> {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/deposit/generate-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: this.user.id,
          currency
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate address');
      }

      return await response.json();
    } catch (error) {
      console.error('Deposit address generation error:', error);
      throw error;
    }
  }

  async requestWithdrawal(amount: number, currency: 'USDT' | 'TON', walletAddress: string): Promise<{
    withdrawal_id: string;
    status: string;
    message: string;
  }> {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/api/withdraw/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: this.user.id,
          amount,
          currency,
          wallet_address: walletAddress
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Withdrawal request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Withdrawal request error:', error);
      throw error;
    }
  }

  // WebSocket methods
  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.user) {
          reject(new Error('User not authenticated'));
          return;
        }

        const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/${this.user.id}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleWebSocketMessage(data: any) {
    const { type, data: messageData } = data;
    const callback = this.wsCallbacks.get(type);
    
    if (callback) {
      callback(messageData);
    }
  }

  onWebSocketMessage(type: string, callback: (data: any) => void) {
    this.wsCallbacks.set(type, callback);
  }

  offWebSocketMessage(type: string) {
    this.wsCallbacks.delete(type);
  }

  // Game methods
  joinGame(roomId: string) {
    if (this.ws) {
      this.ws.send(JSON.stringify({
        type: 'join_room',
        room_id: roomId
      }));
    }
  }

  selectCards(roomId: string, cardIds: number[]) {
    if (this.ws) {
      this.ws.send(JSON.stringify({
        type: 'select_cards',
        room_id: roomId,
        card_ids: cardIds
      }));
    }
  }

  claimBingo(roomId: string) {
    if (this.ws) {
      this.ws.send(JSON.stringify({
        type: 'claim_bingo',
        room_id: roomId
      }));
    }
  }

  // Utility methods
  getCurrentUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  getBalanceBreakdown(): {
    total: number;
    withdrawable: number;
    playable: number;
  } {
    if (!this.user) {
      return { total: 0, withdrawable: 0, playable: 0 };
    }

    return {
      total: this.user.won_balance + this.user.deposited_balance,
      withdrawable: this.user.won_balance,
      playable: this.user.deposited_balance
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

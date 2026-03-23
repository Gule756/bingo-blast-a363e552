export type GamePhase = 'welcome' | 'stakeSelect' | 'deposit' | 'lobby' | 'warning' | 'game' | 'gameover' | 'profile';
export type PlayerMode = 'player' | 'spectator' | 'eliminated';
export type WinPattern = 'Row' | 'Column' | 'Diagonal' | 'Four Corners' | 'Full House' | null;

export interface BingoCard {
  id: number;
  numbers: (number | null)[][]; // 5x5, center is null (free)
  isEliminated?: boolean;
}

export interface CalledNumber {
  number: number;
  letter: string;
  timestamp: number;
}

export interface UserProfile {
  id: string;
  telegramId: string;
  name: string;
  phone: string;
  balance: number;
  totalWins: number;
}

export interface GameRoom {
  id: string;
  stake: number;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  countdownSeconds: number;
  countdownStartedAt: string | null;
  playerCount: number;
  maxPlayers: number;
  createdBy: string | null;
}

export interface GameState {
  phase: GamePhase;
  timer: number;
  playerMode: PlayerMode;
  selectedStacks: Set<number>;
  occupiedStacks: Set<number>;
  bingoCards: BingoCard[];
  calledNumbers: CalledNumber[];
  daubedNumbers: Set<number>;
  isEliminated: boolean;
  eliminatedCardIds: Set<number>;
  winner: string | null;
  winnerCount: number;
  winPattern: WinPattern;
  winningCells: [number, number][];
  winningCardId: number | null;
  user: UserProfile;
  stats: {
    players: number;
    bet: number;
    callCount: number;
  };
  dummyWinRound: boolean;
  depositTxHash: string;
  depositStatus: 'idle' | 'verifying' | 'success' | 'error';
  currentGameRoom: GameRoom | null;
  selectedStake: number;
}

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
export const MIN_BET = 10;
export const STAKE_OPTIONS = [10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
export const DUMMY_WIN_CHANCE = 0.10;
export const DUMMY_NAMES = [
  'Abebe_K', 'Mulu_T', 'Dawit_G', 'Tigist_M', 'Kebede_H',
  'Salam_A', 'Yonas_B', 'Hana_D', 'Bereket_F', 'Liya_S',
];

export function getLetterForNumber(n: number): string {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

export function getLetterColor(letter: string): string {
  switch (letter) {
    case 'B': return 'bingo-header-b';
    case 'I': return 'bingo-header-i';
    case 'N': return 'bingo-header-n';
    case 'G': return 'bingo-header-g';
    case 'O': return 'bingo-header-o';
    default: return 'bg-muted';
  }
}

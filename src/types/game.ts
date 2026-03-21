export type GamePhase = 'welcome' | 'deposit' | 'lobby' | 'warning' | 'game' | 'gameover';
export type PlayerMode = 'player' | 'spectator' | 'eliminated';
export type WinPattern = 'Row' | 'Column' | 'Diagonal' | 'Four Corners' | 'Full House' | null;

export interface BingoCard {
  id: number;
  numbers: (number | null)[][]; // 5x5, center is null (free)
}

export interface CalledNumber {
  number: number;
  letter: string;
  timestamp: number;
}

export interface UserProfile {
  telegramId: string;
  name: string;
  balance: number;
  totalWins: number;
}

export interface GameState {
  phase: GamePhase;
  timer: number;
  playerMode: PlayerMode;
  selectedStack: number | null;
  occupiedStacks: Set<number>;
  bingoCard: BingoCard | null;
  calledNumbers: CalledNumber[];
  daubedNumbers: Set<number>;
  isEliminated: boolean;
  winner: string | null;
  winPattern: WinPattern;
  winningCells: [number, number][];
  user: UserProfile;
  stats: {
    players: number;
    bet: number;
    callCount: number;
  };
  dummyWinRound: boolean; // house edge: true if this round is rigged
  depositTxHash: string;
  depositStatus: 'idle' | 'verifying' | 'success' | 'error';
}

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
export const MIN_BET = 2;
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

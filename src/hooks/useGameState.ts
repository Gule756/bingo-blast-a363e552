import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState, GamePhase, BingoCard, CalledNumber,
  getLetterForNumber, MIN_BET, DUMMY_WIN_CHANCE, DUMMY_NAMES,
} from '@/types/game';
import { hapticImpact, hapticNotification, hapticSelection } from '@/lib/haptic';
import { sanitizeInput, playerNameSchema, txHashSchema, numberSchema, RateLimiter, validateGameIntegrity } from '@/lib/security';
import { useTabSync } from './useTabSync';

function generateBingoCard(stackId: number): BingoCard {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const numbers: (number|null)[][] = [];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const pool = Array.from({length: max-min+1}, (_,i) => i+min);
    const picked: (number|null)[] = [];
    for (let r = 0; r < 5; r++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    numbers.push(picked);
  }
  const grid: (number|null)[][] = [];
  for (let r = 0; r < 5; r++) {
    const row: (number|null)[] = [];
    for (let c = 0; c < 5; c++) {
      row.push(r === 2 && c === 2 ? null : numbers[c][r]);
    }
    grid.push(row);
  }
  return { id: stackId, numbers: grid };
}

function generateOccupied(): Set<number> {
  const s = new Set<number>();
  const count = Math.floor(Math.random() * 30) + 10;
  while (s.size < count) s.add(Math.floor(Math.random() * 200) + 1);
  return s;
}

const LOBBY_TIME = 30;
const WARNING_TIME = 5;
const CALL_INTERVAL = 3000;
const DUMMY_WIN_CALL = 20; // dummy wins after ~20 calls

const DEFAULT_USER = {
  telegramId: '',
  name: '',
  balance: 74,
  totalWins: 0,
};

export function useGameState() {
  const [state, setState] = useState<GameState>({
    phase: 'welcome',
    timer: LOBBY_TIME,
    playerMode: 'spectator',
    selectedStack: null,
    occupiedStacks: generateOccupied(),
    bingoCard: null,
    calledNumbers: [],
    daubedNumbers: new Set([0]),
    isEliminated: false,
    winner: null,
    user: { ...DEFAULT_USER },
    stats: { players: 9, bet: 10, callCount: 0 },
    dummyWinRound: false,
    depositTxHash: '',
    depositStatus: 'idle',
  });

  // Cross-tab player sync
  const isInGame = state.phase === 'game' && state.playerMode === 'player';
  const { totalPlayers } = useTabSync(state.user.name, isInGame);

  // Rate limiters for security
  const daubLimiter = useRef(new RateLimiter(10, 1000)); // max 10 daubs/sec
  const claimLimiter = useRef(new RateLimiter(2, 5000)); // max 2 claims/5sec

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const callRef = useRef<ReturnType<typeof setInterval>>();
  const usedNumbers = useRef<Set<number>>(new Set());

  const canAffordBet = state.user.balance >= MIN_BET;

  const setPhase = useCallback((phase: GamePhase) => {
    setState(s => ({ ...s, phase }));
  }, []);

  // Auth: validate + sanitize name
  const authenticate = useCallback((rawName: string) => {
    const result = playerNameSchema.safeParse(rawName);
    if (!result.success) {
      hapticNotification('error');
      return;
    }
    const name = result.data;
    hapticNotification('success');
    setState(s => ({
      ...s,
      phase: 'lobby',
      user: { ...s.user, telegramId: 'tg_' + Date.now(), name },
    }));
  }, []);

  // Deposit: validate TxHash format
  const submitDeposit = useCallback((rawHash: string) => {
    const result = txHashSchema.safeParse(rawHash);
    if (!result.success) {
      hapticNotification('error');
      setState(s => ({ ...s, depositStatus: 'error' }));
      return;
    }
    const txHash = result.data;
    setState(s => ({ ...s, depositTxHash: txHash, depositStatus: 'verifying' }));
    setTimeout(() => {
      setState(s => {
        if (s.depositStatus !== 'verifying') return s;
        const valid = Math.random() > 0.2;
        if (valid) {
          hapticNotification('success');
          return { ...s, depositStatus: 'success', user: { ...s.user, balance: s.user.balance + 50 } };
        }
        hapticNotification('error');
        return { ...s, depositStatus: 'error' };
      });
    }, 2000);
  }, []);

  const resetDeposit = useCallback(() => {
    setState(s => ({ ...s, depositStatus: 'idle', depositTxHash: '' }));
  }, []);

  // Stack selection
  const selectStack = useCallback((id: number) => {
    setState(s => {
      if (s.occupiedStacks.has(id)) {
        hapticImpact('heavy');
        return s;
      }
      hapticSelection();
      return { ...s, selectedStack: s.selectedStack === id ? null : id };
    });
  }, []);

  // Lobby timer
  useEffect(() => {
    if (state.phase !== 'lobby') return;
    setState(s => ({
      ...s,
      timer: LOBBY_TIME,
      selectedStack: null,
      occupiedStacks: generateOccupied(),
      dummyWinRound: Math.random() < DUMMY_WIN_CHANCE,
    }));
    timerRef.current = setInterval(() => {
      setState(s => {
        const next = s.timer - 1;
        if (next <= WARNING_TIME && s.phase === 'lobby') {
          return { ...s, timer: next, phase: 'warning' };
        }
        if (next <= 0) return s;
        return { ...s, timer: next };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state.phase === 'lobby']);

  // Warning timer → game (NON-BLOCKING: users can still select stacks)
  useEffect(() => {
    if (state.phase !== 'warning') return;
    timerRef.current = setInterval(() => {
      setState(s => {
        const next = s.timer - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          const hasStack = s.selectedStack !== null;
          const canPlay = hasStack && s.user.balance >= MIN_BET;
          const mode = canPlay ? 'player' : 'spectator';
          const card = canPlay && s.selectedStack ? generateBingoCard(s.selectedStack) : null;
          const newBalance = canPlay ? s.user.balance - s.stats.bet : s.user.balance;
          return {
            ...s,
            timer: 0,
            phase: 'game',
            playerMode: mode,
            bingoCard: card,
            calledNumbers: [],
            daubedNumbers: new Set([0]),
            isEliminated: false,
            winner: null,
            user: { ...s.user, balance: newBalance },
            stats: { ...s.stats, callCount: 0 },
          };
        }
        return { ...s, timer: next };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state.phase === 'warning']);

  // Game: call numbers
  useEffect(() => {
    if (state.phase !== 'game') return;
    usedNumbers.current = new Set();

    const callNumber = () => {
      setState(s => {
        if (usedNumbers.current.size >= 75) {
          clearInterval(callRef.current);
          return { ...s, phase: 'gameover', winner: null };
        }

        // House edge: dummy wins at specific call count
        if (s.dummyWinRound && usedNumbers.current.size === DUMMY_WIN_CALL) {
          clearInterval(callRef.current);
          const dummyName = DUMMY_NAMES[Math.floor(Math.random() * DUMMY_NAMES.length)];
          hapticNotification('warning');
          return { ...s, phase: 'gameover', winner: dummyName };
        }

        let num: number;
        do { num = Math.floor(Math.random() * 75) + 1; } while (usedNumbers.current.has(num));
        usedNumbers.current.add(num);
        const called: CalledNumber = { number: num, letter: getLetterForNumber(num), timestamp: Date.now() };
        return {
          ...s,
          calledNumbers: [...s.calledNumbers, called],
          stats: { ...s.stats, callCount: s.calledNumbers.length + 1 },
        };
      });
    };

    callNumber();
    callRef.current = setInterval(callNumber, CALL_INTERVAL);
    return () => clearInterval(callRef.current);
  }, [state.phase === 'game']);

  // Manual daub - validated + rate limited
  const daubNumber = useCallback((num: number) => {
    const valid = numberSchema.safeParse(num);
    if (!valid.success) return;
    if (!daubLimiter.current.canAct()) return;

    setState(s => {
      if (s.isEliminated || s.playerMode !== 'player') return s;
      if (!s.calledNumbers.some(c => c.number === num)) return s;
      hapticSelection();
      const next = new Set(s.daubedNumbers);
      next.add(num);
      return { ...s, daubedNumbers: next };
    });
  }, []);

  // Check bingo patterns
  const checkBingo = useCallback((): boolean => {
    const s = state;
    if (!s.bingoCard) return false;
    const grid = s.bingoCard.numbers;
    const isDaubed = (r: number, c: number) =>
      (r === 2 && c === 2) || (grid[r][c] !== null && s.daubedNumbers.has(grid[r][c]!));

    for (let r = 0; r < 5; r++) if ([0,1,2,3,4].every(c => isDaubed(r, c))) return true;
    for (let c = 0; c < 5; c++) if ([0,1,2,3,4].every(r => isDaubed(r, c))) return true;
    if ([0,1,2,3,4].every(i => isDaubed(i, i))) return true;
    if ([0,1,2,3,4].every(i => isDaubed(i, 4-i))) return true;
    if (isDaubed(0,0) && isDaubed(0,4) && isDaubed(4,0) && isDaubed(4,4)) return true;
    return false;
  }, [state]);

  // Claim bingo - rate limited + integrity verified
  const claimBingo = useCallback(() => {
    if (!claimLimiter.current.canAct()) return;

    // Integrity check: all daubed numbers must be in called numbers
    if (!validateGameIntegrity({ daubedNumbers: state.daubedNumbers, calledNumbers: state.calledNumbers })) {
      hapticNotification('error');
      setState(s => ({ ...s, isEliminated: true, playerMode: 'eliminated' }));
      return;
    }

    if (checkBingo()) {
      clearInterval(callRef.current);
      hapticNotification('success');
      const prize = state.stats.bet * state.stats.players * 0.9;
      setState(s => ({
        ...s,
        phase: 'gameover',
        winner: s.user.name || 'You',
        user: { ...s.user, balance: s.user.balance + prize, totalWins: s.user.totalWins + 1 },
      }));
    } else {
      hapticNotification('error');
      setState(s => ({ ...s, isEliminated: true, playerMode: 'eliminated' }));
    }
  }, [checkBingo, state.stats, state.daubedNumbers, state.calledNumbers]);

  const returnToLobby = useCallback(() => {
    setState(s => ({
      ...s,
      phase: 'lobby',
      timer: LOBBY_TIME,
      selectedStack: null,
      bingoCard: null,
      calledNumbers: [],
      daubedNumbers: new Set([0]),
      isEliminated: false,
      playerMode: 'spectator',
      winner: null,
      stats: { ...s.stats, callCount: 0 },
    }));
  }, []);

  const daubedCount = state.daubedNumbers.size - 1;

  // Sync cross-tab player count into stats
  useEffect(() => {
    setState(s => {
      const basePlayers = 8; // simulated base players
      const newCount = basePlayers + totalPlayers;
      if (s.stats.players === newCount) return s;
      return { ...s, stats: { ...s.stats, players: newCount } };
    });
  }, [totalPlayers]);

  return {
    state,
    canAffordBet,
    daubedCount,
    totalPlayers,
    authenticate,
    submitDeposit,
    resetDeposit,
    selectStack,
    daubNumber,
    claimBingo,
    returnToLobby,
    setPhase,
  };
}

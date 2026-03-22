import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState, GamePhase, BingoCard, CalledNumber, WinPattern,
  getLetterForNumber, MIN_BET, DUMMY_WIN_CHANCE, DUMMY_NAMES,
} from '@/types/game';
import { hapticImpact, hapticNotification, hapticSelection } from '@/lib/haptic';
import { playerNameSchema, txHashSchema, numberSchema, RateLimiter, validateGameIntegrity } from '@/lib/security';
import { useTabSync } from './useTabSync';
import { supabase } from '@/integrations/supabase/client';

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

const LOBBY_TIME = 30;
const WARNING_TIME = 5;
const CALL_INTERVAL = 3000;
const DUMMY_WIN_CALL = 20;

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
    selectedStacks: new Set<number>(),
    occupiedStacks: new Set<number>(),
    bingoCards: [],
    calledNumbers: [],
    daubedNumbers: new Set([0]),
    isEliminated: false,
    winner: null,
    winPattern: null,
    winningCells: [],
    winningCardId: null,
    user: { ...DEFAULT_USER },
    stats: { players: 9, bet: 10, callCount: 0 },
    dummyWinRound: false,
    depositTxHash: '',
    depositStatus: 'idle',
  });

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const callRef = useRef<ReturnType<typeof setInterval>>();
  const usedNumbers = useRef<Set<number>>(new Set());

  const daubLimiter = useRef(new RateLimiter(10, 1000));
  const claimLimiter = useRef(new RateLimiter(2, 5000));

  const isInGame = state.phase === 'game' && state.playerMode === 'player';
  const { totalPlayers, occupiedByOthers, broadcastStackSelect } = useTabSync(state.user.name || 'Player', isInGame);

  const mergedOccupied = new Set([...state.occupiedStacks, ...occupiedByOthers]);

  const canAffordBet = state.user.balance >= MIN_BET;

  const setPhase = useCallback((phase: GamePhase) => {
    setState(s => ({ ...s, phase }));
  }, []);

  const authenticate = useCallback(async (rawName: string, rawPhone: string) => {
    const result = playerNameSchema.safeParse(rawName);
    if (!result.success) {
      hapticNotification('error');
      return;
    }
    const name = result.data;
    const phone = rawPhone.replace(/[^+0-9]/g, '').slice(0, 15);
    const telegramId = 'tg_' + Date.now();

    try {
      await supabase.from('players').upsert(
        { telegram_id: telegramId, name, phone },
        { onConflict: 'telegram_id' }
      );
    } catch (e) {
      console.error('Failed to save player contact:', e);
    }

    hapticNotification('success');
    setState(s => ({
      ...s,
      phase: 'lobby',
      user: { ...s.user, telegramId, name },
    }));
  }, []);

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

  // Multi-stack selection - returns action info for toast
  const selectStack = useCallback((id: number): { action: 'selected' | 'unselected'; cardId: number; totalSelected: number } | null => {
    let result: { action: 'selected' | 'unselected'; cardId: number; totalSelected: number } | null = null;
    setState(s => {
      if (occupiedByOthers.has(id)) {
        hapticImpact('heavy');
        return s;
      }
      const next = new Set(s.selectedStacks);
      if (next.has(id)) {
        // Unselect
        next.delete(id);
        result = { action: 'unselected', cardId: id, totalSelected: next.size };
        broadcastStackSelect(id, false);
        hapticSelection();
      } else {
        // Check if can afford another card
        const costAfter = next.size + 1;
        if (s.user.balance < s.stats.bet * costAfter) {
          hapticImpact('heavy');
          return s;
        }
        next.add(id);
        result = { action: 'selected', cardId: id, totalSelected: next.size };
        broadcastStackSelect(id, true);
        hapticSelection();
      }
      return { ...s, selectedStacks: next };
    });
    return result;
  }, [occupiedByOthers, broadcastStackSelect]);

  // Lobby timer
  useEffect(() => {
    if (state.phase !== 'lobby') return;
    setState(s => ({
      ...s,
      timer: LOBBY_TIME,
      selectedStacks: new Set<number>(),
      occupiedStacks: new Set<number>(),
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

  // Warning timer → game
  useEffect(() => {
    if (state.phase !== 'warning') return;
    timerRef.current = setInterval(() => {
      setState(s => {
        const next = s.timer - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          const hasStacks = s.selectedStacks.size > 0;
          const totalCost = s.selectedStacks.size * s.stats.bet;
          const canPlay = hasStacks && s.user.balance >= totalCost;
          const mode = canPlay ? 'player' : 'spectator';
          const cards = canPlay
            ? Array.from(s.selectedStacks).map(id => generateBingoCard(id))
            : [];
          const newBalance = canPlay ? s.user.balance - totalCost : s.user.balance;
          return {
            ...s,
            timer: 0,
            phase: 'game',
            playerMode: mode,
            bingoCards: cards,
            calledNumbers: [],
            daubedNumbers: new Set([0]),
            isEliminated: false,
            winner: null,
            winPattern: null,
            winningCells: [],
            winningCardId: null,
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
          return { ...s, phase: 'gameover', winner: null, winningCells: [], winningCardId: null };
        }

        if (s.dummyWinRound && usedNumbers.current.size === DUMMY_WIN_CALL) {
          clearInterval(callRef.current);
          const dummyName = DUMMY_NAMES[Math.floor(Math.random() * DUMMY_NAMES.length)];
          hapticNotification('warning');
          return { ...s, phase: 'gameover', winner: dummyName, winningCells: [], winningCardId: null };
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

  // Manual daub toggle
  const daubNumber = useCallback((num: number) => {
    const valid = numberSchema.safeParse(num);
    if (!valid.success) return;
    if (!daubLimiter.current.canAct()) return;

    setState(s => {
      if (s.isEliminated || s.playerMode !== 'player') return s;
      hapticSelection();
      const next = new Set(s.daubedNumbers);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return { ...s, daubedNumbers: next };
    });
  }, []);

  // Check bingo across ALL cards - returns best result
  const checkBingo = useCallback((): { pattern: WinPattern; cells: [number, number][]; cardId: number | null } => {
    const s = state;
    if (s.bingoCards.length === 0) return { pattern: null, cells: [], cardId: null };

    for (const card of s.bingoCards) {
      const grid = card.numbers;
      const isDaubed = (r: number, c: number) =>
        (r === 2 && c === 2) || (grid[r][c] !== null && s.daubedNumbers.has(grid[r][c]!));

      // Full House
      if (grid.every((row, r) => row.every((_, c) => isDaubed(r, c)))) {
        const cells: [number, number][] = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push([r, c]);
        return { pattern: 'Full House', cells, cardId: card.id };
      }
      // Rows
      for (let r = 0; r < 5; r++) {
        if ([0,1,2,3,4].every(c => isDaubed(r, c))) {
          return { pattern: 'Row', cells: [0,1,2,3,4].map(c => [r, c] as [number, number]), cardId: card.id };
        }
      }
      // Columns
      for (let c = 0; c < 5; c++) {
        if ([0,1,2,3,4].every(r => isDaubed(r, c))) {
          return { pattern: 'Column', cells: [0,1,2,3,4].map(r => [r, c] as [number, number]), cardId: card.id };
        }
      }
      // Diagonals
      if ([0,1,2,3,4].every(i => isDaubed(i, i))) {
        return { pattern: 'Diagonal', cells: [0,1,2,3,4].map(i => [i, i] as [number, number]), cardId: card.id };
      }
      if ([0,1,2,3,4].every(i => isDaubed(i, 4-i))) {
        return { pattern: 'Diagonal', cells: [0,1,2,3,4].map(i => [i, 4-i] as [number, number]), cardId: card.id };
      }
      // Four Corners
      if (isDaubed(0,0) && isDaubed(0,4) && isDaubed(4,0) && isDaubed(4,4)) {
        return { pattern: 'Four Corners', cells: [[0,0],[0,4],[4,0],[4,4]], cardId: card.id };
      }
    }
    return { pattern: null, cells: [], cardId: null };
  }, [state]);

  // Claim bingo
  const claimBingo = useCallback(() => {
    if (!claimLimiter.current.canAct()) return;

    if (!validateGameIntegrity({ daubedNumbers: state.daubedNumbers, calledNumbers: state.calledNumbers })) {
      hapticNotification('error');
      setState(s => ({ ...s, isEliminated: true, playerMode: 'eliminated' }));
      return;
    }

    const result = checkBingo();
    if (result.pattern) {
      clearInterval(callRef.current);
      hapticNotification('success');
      const prize = state.stats.bet * state.stats.players * 0.9;
      setState(s => ({
        ...s,
        phase: 'gameover',
        winner: s.user.name || 'You',
        winPattern: result.pattern,
        winningCells: result.cells,
        winningCardId: result.cardId,
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
      selectedStacks: new Set<number>(),
      bingoCards: [],
      calledNumbers: [],
      daubedNumbers: new Set([0]),
      isEliminated: false,
      playerMode: 'spectator',
      winner: null,
      winPattern: null,
      winningCells: [],
      winningCardId: null,
      stats: { ...s.stats, callCount: 0 },
    }));
  }, []);

  const daubedCount = state.daubedNumbers.size - 1;

  useEffect(() => {
    setState(s => {
      if (s.stats.players === totalPlayers) return s;
      return { ...s, stats: { ...s.stats, players: totalPlayers } };
    });
  }, [totalPlayers]);

  return {
    state,
    mergedOccupied,
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

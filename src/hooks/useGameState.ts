import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState, GamePhase, BingoCard, CalledNumber, WinPattern,
  getLetterForNumber, MIN_BET, DUMMY_WIN_CHANCE, DUMMY_NAMES,
} from '@/types/game';
import { hapticImpact, hapticNotification, hapticSelection } from '@/lib/haptic';
import { playerNameSchema, txHashSchema, numberSchema, RateLimiter } from '@/lib/security';
import { useTabSync } from './useTabSync';
import { supabase } from '@/integrations/supabase/client';

// Fisher-Yates shuffle utility
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Column-restricted card generation with Fisher-Yates per column
function generateBingoCard(stackId: number, existingCards: BingoCard[] = []): BingoCard {
  const ranges: [number, number][] = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  let grid: (number|null)[][];
  let attempts = 0;

  do {
    const columns: number[][] = ranges.map(([min, max]) => {
      const pool = Array.from({length: max - min + 1}, (_, i) => i + min);
      return fisherYatesShuffle(pool).slice(0, 5);
    });
    grid = [];
    for (let r = 0; r < 5; r++) {
      const row: (number|null)[] = [];
      for (let c = 0; c < 5; c++) {
        row.push(r === 2 && c === 2 ? null : columns[c][r]);
      }
      grid.push(row);
    }
    attempts++;
  } while (attempts < 10 && existingCards.some(ec => cardFingerprint(ec) === gridFingerprint(grid)));

  return { id: stackId, numbers: grid };
}

// Fingerprint for duplicate detection
function gridFingerprint(grid: (number|null)[][]): string {
  return grid.flat().filter(n => n !== null).join(',');
}
function cardFingerprint(card: BingoCard): string {
  return gridFingerprint(card.numbers);
}

// Pre-shuffle all 75 numbers for fair calling (Fisher-Yates)
function generateCallSequence(): number[] {
  return fisherYatesShuffle(Array.from({length: 75}, (_, i) => i + 1));
}

const LOBBY_TIME = 30;
const WARNING_TIME = 5;
const CALL_INTERVAL = 3000;
const DUMMY_WIN_CALL = 20;

const DEFAULT_USER = {
  id: '',
  telegramId: '',
  name: '',
  phone: '',
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
    eliminatedCardIds: new Set<number>(),
    winner: null,
    winnerCount: 1,
    winPattern: null,
    winningCells: [],
    winningCardId: null,
    user: { ...DEFAULT_USER },
    stats: { players: 1, bet: 10, callCount: 0 },
    dummyWinRound: false,
    depositTxHash: '',
    depositStatus: 'idle',
    currentGameRoom: null,
    selectedStake: 10,
  });

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const callRef = useRef<ReturnType<typeof setInterval>>();
  const callSequenceRef = useRef<number[]>([]);
  const callIndexRef = useRef(0);

  const daubLimiter = useRef(new RateLimiter(10, 1000));
  const claimLimiter = useRef(new RateLimiter(2, 5000));

  const isInGame = state.phase === 'game' && state.playerMode === 'player';
  const { totalPlayers, occupiedByOthers, broadcastStackSelect } = useTabSync(state.user.name || 'Player', isInGame);

  const mergedOccupied = new Set([...state.occupiedStacks, ...occupiedByOthers]);

  const canAffordBet = state.user.balance >= state.stats.bet;

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

    let playerId = '';
    try {
      const { data } = await supabase.from('players').upsert(
        { telegram_id: telegramId, name, phone },
        { onConflict: 'telegram_id' }
      ).select('id').single();
      if (data) playerId = data.id;
    } catch (e) {
      console.error('Failed to save player contact:', e);
    }

    hapticNotification('success');
    setState(s => ({
      ...s,
      phase: 'stakeSelect',
      user: { ...s.user, id: playerId, telegramId, name, phone },
    }));
  }, []);

  const selectStake = useCallback((stake: number) => {
    setState(s => ({ ...s, selectedStake: stake, stats: { ...s.stats, bet: stake } }));
  }, []);

  const createGame = useCallback(async (stake: number, countdownSeconds: number) => {
    const { data } = await supabase.from('games').insert({
      stake,
      countdown_seconds: countdownSeconds,
      created_by: state.user.id || null,
    }).select().single();

    if (data) {
      setState(s => ({
        ...s,
        phase: 'lobby',
        timer: countdownSeconds,
        selectedStake: stake,
        stats: { ...s.stats, bet: stake },
        currentGameRoom: {
          id: data.id,
          stake: data.stake,
          status: data.status as any,
          countdownSeconds: data.countdown_seconds,
          countdownStartedAt: data.countdown_started_at,
          playerCount: 1,
          maxPlayers: data.max_players || 200,
          createdBy: data.created_by,
        },
      }));
    }
  }, [state.user.id]);

  const joinGame = useCallback(async (gameId: string, stake: number) => {
    // Join the game
    if (state.user.id) {
      await supabase.from('game_players').upsert({
        game_id: gameId,
        player_id: state.user.id,
        stack_ids: [],
      }, { onConflict: 'game_id,player_id' });
    }

    // Fetch game details
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (data) {
      setState(s => ({
        ...s,
        phase: 'lobby',
        timer: data.countdown_seconds,
        selectedStake: stake,
        stats: { ...s.stats, bet: stake },
        currentGameRoom: {
          id: data.id,
          stake: data.stake,
          status: data.status as any,
          countdownSeconds: data.countdown_seconds,
          countdownStartedAt: data.countdown_started_at,
          playerCount: 0,
          maxPlayers: data.max_players || 200,
          createdBy: data.created_by,
        },
      }));
    }
  }, [state.user.id]);

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

  // Multi-stack selection
  const selectStack = useCallback((id: number): { action: 'selected' | 'unselected'; cardId: number; totalSelected: number } | null => {
    let result: { action: 'selected' | 'unselected'; cardId: number; totalSelected: number } | null = null;
    setState(s => {
      if (occupiedByOthers.has(id)) {
        hapticImpact('heavy');
        return s;
      }
      const next = new Set(s.selectedStacks);
      if (next.has(id)) {
        next.delete(id);
        result = { action: 'unselected', cardId: id, totalSelected: next.size };
        broadcastStackSelect(id, false);
        hapticSelection();
      } else {
        if (next.size >= 3) {
          hapticImpact('heavy');
          return s;
        }
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
      timer: s.currentGameRoom?.countdownSeconds || LOBBY_TIME,
      selectedStacks: new Set<number>(),
      occupiedStacks: new Set<number>(),
      eliminatedCardIds: new Set<number>(),
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
          const generatedCards: BingoCard[] = [];
          if (canPlay) {
            Array.from(s.selectedStacks).forEach(id => {
              generatedCards.push(generateBingoCard(id, generatedCards));
            });
          }
            
          const newBalance = canPlay ? s.user.balance - totalCost : s.user.balance;
          return {
            ...s,
            timer: 0,
            phase: 'game',
            playerMode: mode,
            bingoCards: generatedCards,
            calledNumbers: [],
            daubedNumbers: new Set([0]),
            isEliminated: false,
            eliminatedCardIds: new Set<number>(),
            winner: null,
            winnerCount: 1,
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

  // Game: call numbers using pre-shuffled Fisher-Yates sequence
  useEffect(() => {
    if (state.phase !== 'game') return;
    callSequenceRef.current = generateCallSequence();
    callIndexRef.current = 0;

    const callNumber = () => {
      setState(s => {
        if (callIndexRef.current >= 75) {
          clearInterval(callRef.current);
          return { ...s, phase: 'gameover', winner: null, winningCells: [], winningCardId: null };
        }

        if (s.dummyWinRound && callIndexRef.current === DUMMY_WIN_CALL) {
          clearInterval(callRef.current);
          const dummyName = DUMMY_NAMES[Math.floor(Math.random() * DUMMY_NAMES.length)];
          hapticNotification('warning');
          return { ...s, phase: 'gameover', winner: dummyName, winningCells: [], winningCardId: null };
        }

        const num = callSequenceRef.current[callIndexRef.current];
        callIndexRef.current++;
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
      if (s.playerMode !== 'player') return s;
      // Check if all cards eliminated
      if (s.bingoCards.every(c => s.eliminatedCardIds.has(c.id))) return s;
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

  // Check bingo for a SPECIFIC card
  const checkBingoForCard = useCallback((cardId: number): { pattern: WinPattern; cells: [number, number][] } => {
    const s = state;
    const card = s.bingoCards.find(c => c.id === cardId);
    if (!card) return { pattern: null, cells: [] };

    const grid = card.numbers;
    const calledSet = new Set(s.calledNumbers.map(c => c.number));
    const isDaubed = (r: number, c: number) => {
      if (r === 2 && c === 2) return true; // free space
      if (grid[r][c] === null) return false;
      const num = grid[r][c]!;
      return s.daubedNumbers.has(num) && calledSet.has(num);
    };

    // Full House
    if (grid.every((row, r) => row.every((_, c) => isDaubed(r, c)))) {
      const cells: [number, number][] = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push([r, c]);
      return { pattern: 'Full House', cells };
    }
    // Rows
    for (let r = 0; r < 5; r++) {
      if ([0,1,2,3,4].every(c => isDaubed(r, c))) {
        return { pattern: 'Row', cells: [0,1,2,3,4].map(c => [r, c] as [number, number]) };
      }
    }
    // Columns
    for (let c = 0; c < 5; c++) {
      if ([0,1,2,3,4].every(r => isDaubed(r, c))) {
        return { pattern: 'Column', cells: [0,1,2,3,4].map(r => [r, c] as [number, number]) };
      }
    }
    // Diagonals
    if ([0,1,2,3,4].every(i => isDaubed(i, i))) {
      return { pattern: 'Diagonal', cells: [0,1,2,3,4].map(i => [i, i] as [number, number]) };
    }
    if ([0,1,2,3,4].every(i => isDaubed(i, 4-i))) {
      return { pattern: 'Diagonal', cells: [0,1,2,3,4].map(i => [i, 4-i] as [number, number]) };
    }
    // Four Corners
    if (isDaubed(0,0) && isDaubed(0,4) && isDaubed(4,0) && isDaubed(4,4)) {
      return { pattern: 'Four Corners', cells: [[0,0],[0,4],[4,0],[4,4]] };
    }
    // Postage Stamp (2x2 in any corner)
    const corners: [number, number][] = [[0,0],[0,3],[3,0],[3,3]];
    for (const [sr, sc] of corners) {
      if (isDaubed(sr,sc) && isDaubed(sr,sc+1) && isDaubed(sr+1,sc) && isDaubed(sr+1,sc+1)) {
        return { pattern: 'Postage Stamp' as WinPattern, cells: [[sr,sc],[sr,sc+1],[sr+1,sc],[sr+1,sc+1]] };
      }
    }
    // Outside Frame (all edge cells)
    const frameCells: [number, number][] = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 4 || c === 0 || c === 4) frameCells.push([r, c]);
    }
    if (frameCells.every(([r, c]) => isDaubed(r, c))) {
      return { pattern: 'Outside Frame' as WinPattern, cells: frameCells };
    }
    return { pattern: null, cells: [] };
  }, [state]);

  // Claim bingo for a specific card
  const claimBingo = useCallback((cardId: number) => {
    if (!claimLimiter.current.canAct()) return;

    const result = checkBingoForCard(cardId);
    if (result.pattern) {
      clearInterval(callRef.current);
      hapticNotification('success');
      // Prize pool: each player pays bet * their_card_count. Total = sum of all entries * 0.9
      // We know: this player's cards + (other players * 1 card assumed average)
      const otherPlayers = Math.max(state.stats.players - 1, 0);
      const totalEntryFees = (state.bingoCards.length * state.stats.bet) + (otherPlayers * state.stats.bet);
      const prize = totalEntryFees * 0.9;
      setState(s => ({
        ...s,
        phase: 'gameover',
        winner: s.user.name || 'You',
        winnerCount: 1,
        winPattern: result.pattern,
        winningCells: result.cells,
        winningCardId: cardId,
        user: { ...s.user, balance: s.user.balance + prize, totalWins: s.user.totalWins + 1 },
      }));
    } else {
      hapticNotification('error');
      // Only eliminate this specific card
      setState(s => {
        const newEliminated = new Set(s.eliminatedCardIds);
        newEliminated.add(cardId);
        const allEliminated = s.bingoCards.every(c => newEliminated.has(c.id));
        return {
          ...s,
          eliminatedCardIds: newEliminated,
          isEliminated: allEliminated,
          playerMode: allEliminated ? 'eliminated' : s.playerMode,
        };
      });
    }
  }, [checkBingoForCard, state.stats, state.daubedNumbers, state.calledNumbers]);

  const returnToLobby = useCallback(() => {
    setState(s => ({
      ...s,
      phase: 'stakeSelect',
      timer: LOBBY_TIME,
      selectedStacks: new Set<number>(),
      bingoCards: [],
      calledNumbers: [],
      daubedNumbers: new Set([0]),
      isEliminated: false,
      eliminatedCardIds: new Set<number>(),
      playerMode: 'spectator',
      winner: null,
      winnerCount: 1,
      winPattern: null,
      winningCells: [],
      winningCardId: null,
      stats: { ...s.stats, callCount: 0 },
      currentGameRoom: null,
    }));
  }, []);

  const daubedCount = state.daubedNumbers.size - 1;

  useEffect(() => {
    setState(s => {
      if (s.stats.players === totalPlayers) return s;
      return { ...s, stats: { ...s.stats, players: totalPlayers } };
    });
  }, [totalPlayers]);

  const updateBalance = useCallback((newBalance: number) => {
    setState(s => ({ ...s, user: { ...s.user, balance: newBalance } }));
  }, []);

  const logout = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(callRef.current);
    setState({
      phase: 'welcome',
      timer: LOBBY_TIME,
      playerMode: 'spectator',
      selectedStacks: new Set<number>(),
      occupiedStacks: new Set<number>(),
      bingoCards: [],
      calledNumbers: [],
      daubedNumbers: new Set([0]),
      isEliminated: false,
      eliminatedCardIds: new Set<number>(),
      winner: null,
      winnerCount: 1,
      winPattern: null,
      winningCells: [],
      winningCardId: null,
      user: { ...DEFAULT_USER },
      stats: { players: 1, bet: 10, callCount: 0 },
      dummyWinRound: false,
      depositTxHash: '',
      depositStatus: 'idle',
      currentGameRoom: null,
      selectedStake: 10,
    });
  }, []);

  return {
    state,
    mergedOccupied,
    canAffordBet,
    daubedCount,
    totalPlayers,
    authenticate,
    selectStake,
    createGame,
    joinGame,
    submitDeposit,
    resetDeposit,
    selectStack,
    daubNumber,
    claimBingo,
    returnToLobby,
    setPhase,
    updateBalance,
    logout,
  };
}

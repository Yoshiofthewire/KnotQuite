import { useState, useCallback } from 'react';
import { Puzzle } from '../types/puzzle';
import puzzlesData from '../../data/puzzles.json';
import dailyOrderData from '../../data/dailyOrder.json';

export type GameMode = 'daily' | 'random';

const PLAYED_KEY = 'knotquite_played';
const DAILY_KEY = 'knotquite_daily';

interface DailyState {
  date: string;
  completed: boolean;
  won: boolean;
}

// Get today's date in UTC (not local timezone) for daily consistency across time zones
function getTodayString(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailyState(): DailyState | null {
  try {
    const stored = localStorage.getItem(DAILY_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveDailyState(state: DailyState) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(state));
}

export function isDailyCompleted(): boolean {
  const state = getDailyState();
  return state !== null && state.date === getTodayString() && state.completed;
}

export function markDailyCompleted(won: boolean) {
  saveDailyState({ date: getTodayString(), completed: true, won });
}

function getPlayedIds(): number[] {
  try {
    const stored = localStorage.getItem(PLAYED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function markPlayed(id: number) {
  const played = getPlayedIds();
  if (!played.includes(id)) {
    played.push(id);
    localStorage.setItem(PLAYED_KEY, JSON.stringify(played));
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get daily puzzle using epoch-based indexing into dailyOrder
// Epoch: 2025-01-01. Guarantees:
// - No repeats until full cycle
// - Stable across app updates (append new IDs to tail)
// - UTC-based so consistent across timezones
function getDailyPuzzle(): Puzzle {
  const allPuzzles = puzzlesData as Puzzle[];
  const order = (dailyOrderData as number[]) || [];

  if (order.length === 0) {
    // Fallback if dailyOrder not yet built: use first puzzle
    return allPuzzles[0] || ({} as Puzzle);
  }

  // Compute days since epoch (2025-01-01 00:00 UTC)
  const epochDate = new Date('2025-01-01T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysSinceEpoch = Math.floor((today.getTime() - epochDate.getTime()) / 86400000);

  // Index into daily order with wraparound
  const orderIndex = daysSinceEpoch % order.length;
  const puzzleId = order[orderIndex];

  // Look up puzzle by ID
  const puzzle = allPuzzles.find(p => p.id === puzzleId);
  return puzzle || allPuzzles[0] || ({} as Puzzle);
}

function pickRandomPuzzle(): Puzzle {
  const allPuzzles = puzzlesData as Puzzle[];
  const randomPuzzles = allPuzzles.filter((p) => (p as any).type !== 'daily');
  const played = getPlayedIds();
  const unplayed = randomPuzzles.filter((p) => !played.includes(p.id));
  const pool = unplayed.length > 0 ? unplayed : randomPuzzles;
  if (unplayed.length === 0 && randomPuzzles.length > 0) {
    localStorage.removeItem(PLAYED_KEY);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickPuzzle(mode: GameMode): Puzzle {
  return mode === 'daily' ? getDailyPuzzle() : pickRandomPuzzle();
}

export function usePuzzle(initialMode: GameMode = 'daily') {
  const [mode, setMode] = useState<GameMode>(initialMode);

  const [puzzle, setPuzzle] = useState<Puzzle>(() => {
    const p = pickPuzzle(initialMode);
    if (initialMode === 'random') markPlayed(p.id);
    return p;
  });

  const [shuffledWords, setShuffledWords] = useState<string[]>(() => {
    return shuffleArray(puzzle.groups.flatMap((g) => g.words));
  });

  const switchMode = useCallback((newMode: GameMode) => {
    setMode(newMode);
    const p = pickPuzzle(newMode);
    if (newMode === 'random') markPlayed(p.id);
    setPuzzle(p);
    setShuffledWords(shuffleArray(p.groups.flatMap((g) => g.words)));
  }, []);

  const newGame = useCallback(() => {
    if (mode === 'daily') {
      // Daily mode: just reload today's puzzle
      const p = getDailyPuzzle();
      setPuzzle(p);
      setShuffledWords(shuffleArray(p.groups.flatMap((g) => g.words)));
    } else {
      const p = pickRandomPuzzle();
      markPlayed(p.id);
      setPuzzle(p);
      setShuffledWords(shuffleArray(p.groups.flatMap((g) => g.words)));
    }
  }, [mode]);

  const shuffleWords = useCallback((solvedWords: string[]) => {
    setShuffledWords((prev) => {
      const remaining = prev.filter((w) => !solvedWords.includes(w));
      return [...solvedWords, ...shuffleArray(remaining)];
    });
  }, []);

  return { puzzle, shuffledWords, mode, newGame, shuffleWords, switchMode };
}

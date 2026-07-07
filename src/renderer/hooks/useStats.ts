import { useState, useCallback } from 'react';

const STATS_KEY = 'knotquite_stats';

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>; // mistakes used → count
}

const DEFAULT_STATS: Stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
};

function loadStats(): Stats {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) return { ...DEFAULT_STATS, guessDistribution: { ...DEFAULT_STATS.guessDistribution } };
    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_STATS,
      ...parsed,
      guessDistribution: { ...DEFAULT_STATS.guessDistribution, ...parsed.guessDistribution },
    };
  } catch {
    return { ...DEFAULT_STATS, guessDistribution: { ...DEFAULT_STATS.guessDistribution } };
  }
}

function saveStats(stats: Stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function useStats() {
  const [stats, setStats] = useState<Stats>(loadStats);

  const recordGame = useCallback((won: boolean, mistakesUsed: number) => {
    setStats((prev) => {
      const next: Stats = {
        gamesPlayed: prev.gamesPlayed + 1,
        gamesWon: prev.gamesWon + (won ? 1 : 0),
        currentStreak: won ? prev.currentStreak + 1 : 0,
        maxStreak: won
          ? Math.max(prev.maxStreak, prev.currentStreak + 1)
          : prev.maxStreak,
        guessDistribution: {
          ...prev.guessDistribution,
          [mistakesUsed]: (prev.guessDistribution[mistakesUsed] ?? 0) + 1,
        },
      };
      saveStats(next);
      return next;
    });
  }, []);

  return { stats, recordGame };
}

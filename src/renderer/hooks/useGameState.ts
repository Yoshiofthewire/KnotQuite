import { useState, useCallback } from 'react';
import { GameState, GameStatus, Group, Puzzle } from '../types/puzzle';

const MAX_MISTAKES = 4;

export interface GuessResult {
  status: 'correct' | 'wrong' | null;
  distance?: number;
}

export interface GameActions {
  selectWord: (word: string) => void;
  deselectWord: (word: string) => void;
  deselectAll: () => void;
  submitGuess: () => GuessResult;
  resetGame: (puzzle: Puzzle, shuffledWords: string[]) => void;
}

export function useGameState(
  initialPuzzle: Puzzle,
  initialShuffledWords: string[]
): [GameState, GameActions] {
  const [state, setState] = useState<GameState>(() => ({
    puzzle: initialPuzzle,
    shuffledWords: initialShuffledWords,
    selectedWords: [],
    solvedGroups: [],
    mistakesRemaining: MAX_MISTAKES,
    status: 'playing',
    guessHistory: [],
  }));

  const selectWord = useCallback((word: string) => {
    setState((prev) => {
      if (prev.status !== 'playing') return prev;
      if (prev.selectedWords.includes(word)) return prev;
      if (prev.selectedWords.length >= 4) return prev;
      if (prev.solvedGroups.some((g) => g.words.includes(word))) return prev;
      return { ...prev, selectedWords: [...prev.selectedWords, word] };
    });
  }, []);

  const deselectWord = useCallback((word: string) => {
    setState((prev) => ({
      ...prev,
      selectedWords: prev.selectedWords.filter((w) => w !== word),
    }));
  }, []);

  const deselectAll = useCallback(() => {
    setState((prev) => ({ ...prev, selectedWords: [] }));
  }, []);

  const submitGuess = useCallback((): GuessResult => {
    let result: GuessResult = { status: null };

    setState((prev) => {
      if (prev.status !== 'playing') return prev;
      if (prev.selectedWords.length !== 4) return prev;

      const selected = prev.selectedWords;
      const matchingGroup = prev.puzzle.groups.find(
        (g) =>
          !prev.solvedGroups.includes(g) &&
          g.words.every((w) => selected.includes(w))
      );

      if (matchingGroup) {
        const newSolved = [...prev.solvedGroups, matchingGroup];
        const newStatus: GameStatus =
          newSolved.length === 4 ? 'won' : 'playing';
        result = { status: 'correct' };
        return {
          ...prev,
          solvedGroups: newSolved,
          selectedWords: [],
          status: newStatus,
          guessHistory: [...prev.guessHistory, selected],
        };
      }

      // Find closest group to determine distance
      let closestDistance = 0;
      prev.puzzle.groups.forEach((g) => {
        if (!prev.solvedGroups.includes(g)) {
          const matches = g.words.filter((w) => selected.includes(w)).length;
          closestDistance = Math.max(closestDistance, matches);
        }
      });

      const newMistakes = prev.mistakesRemaining - 1;
      const newStatus: GameStatus = newMistakes <= 0 ? 'lost' : 'playing';
      result = { status: 'wrong', distance: 4 - closestDistance };

      return {
        ...prev,
        mistakesRemaining: newMistakes,
        selectedWords: [],
        status: newStatus,
        guessHistory: [...prev.guessHistory, selected],
      };
    });

    return result;
  }, []);

  const resetGame = useCallback(
    (puzzle: Puzzle, shuffledWords: string[]) => {
      setState({
        puzzle,
        shuffledWords,
        selectedWords: [],
        solvedGroups: [],
        mistakesRemaining: MAX_MISTAKES,
        status: 'playing',
        guessHistory: [],
      });
    },
    []
  );

  return [state, { selectWord, deselectWord, deselectAll, submitGuess, resetGame }];
}
